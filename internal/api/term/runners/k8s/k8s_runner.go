package k8s

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"log"

	"k8s.io/apimachinery/pkg/watch"
	v1 "k8s.io/client-go/kubernetes/typed/core/v1"

	"github.com/markdownplayground/markdownplayground/internal/api/term/runners"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/api/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	_ "k8s.io/client-go/plugin/pkg/client/auth"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"
	"k8s.io/client-go/tools/remotecommand"
	"k8s.io/utils/pointer"
)

const sessionIDLabel = "markdown-playground/session-id"

type runner struct {
	restConfig *rest.Config
	restClient rest.Interface
	namespace  string
	k          *kubernetes.Clientset
	pods       v1.PodInterface
}

func (r *runner) Reset(ctx context.Context, session runners.Session) error {
	name := podName(session)
	err := r.pods.Delete(ctx, name, metav1.DeleteOptions{})
	if err != nil && !errors.IsNotFound(err) {
		return err
	}
	return r.waitForPod(ctx, name, func(eventType watch.EventType, pod *corev1.Pod) bool {
		return eventType == watch.Deleted
	})
}

func podName(session runners.Session) string {
	return fmt.Sprintf("%s.markdownplayground", session)
}

func (r *runner) Run(ctx context.Context, session runners.Session, code string) (*runners.RunResult, error) {
	name := podName(session)
	if err := r.deleteCompletedPod(ctx, name); err != nil {
		return nil, err
	}
	if err := r.createPod(ctx, session, name); err != nil {
		return nil, err
	}
	req := r.k.CoreV1().RESTClient().Post().
		Resource("pods").
		Name(name).
		Namespace(r.namespace).
		SubResource("exec").
		Param("container", "main").
		Param("stdout", "true").
		Param("stderr", "true")
	for _, cmd := range []string{"sh", "-c", code} {
		req = req.Param("command", cmd)
	}
	log.Printf("creating executor for pod\n")
	exec, err := remotecommand.NewSPDYExecutor(r.restConfig, "POST", req.URL())
	if err != nil {
		return nil, err
	}
	writer := &bytes.Buffer{}
	log.Printf("streaming %s\n", name)
	err = exec.Stream(remotecommand.StreamOptions{Stdout: writer, Stderr: writer})
	if err != nil {
		_, _ = writer.Write([]byte(fmt.Sprint(err)))
	}
	return &runners.RunResult{Closer: io.NopCloser(writer), Reader: writer}, nil
}

func (r *runner) deleteCompletedPod(ctx context.Context, name string) error {
	log.Printf("deleteting pod %s if completed\n", name)
	pods := r.k.CoreV1().Pods(r.namespace)
	pod, err := pods.Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		if errors.IsNotFound(err) {
			return nil
		}
		return err
	}
	switch pod.Status.Phase {
	case corev1.PodFailed, corev1.PodSucceeded:
		return pods.Delete(ctx, name, metav1.DeleteOptions{})
	}
	return nil
}

func (r *runner) createPod(ctx context.Context, session runners.Session, name string) error {
	log.Printf("creating pod %s\n", name)
	_, err := r.pods.Create(ctx, &corev1.Pod{
		ObjectMeta: metav1.ObjectMeta{
			Name:   name,
			Labels: map[string]string{sessionIDLabel: session},
		},
		Spec: corev1.PodSpec{
			Containers: []corev1.Container{
				{
					Name:       "main",
					Image:      "ubuntu",
					WorkingDir: "/wd",
					Command:    []string{"sh", "-c", "sleep 3600"}, // 1h
					Resources: corev1.ResourceRequirements{
						Limits: map[corev1.ResourceName]resource.Quantity{
							corev1.ResourceCPU:    resource.MustParse("0.5"),
							corev1.ResourceMemory: resource.MustParse("64M"),
						},
						Requests: map[corev1.ResourceName]resource.Quantity{
							corev1.ResourceCPU:    resource.MustParse("0.5"),
							corev1.ResourceMemory: resource.MustParse("64M"),
						},
					},
					ImagePullPolicy: corev1.PullIfNotPresent,
					SecurityContext: &corev1.SecurityContext{
						Capabilities:             &corev1.Capabilities{Drop: []corev1.Capability{"ALL"}},
						Privileged:               pointer.Bool(false),
						RunAsUser:                pointer.Int64(1000),
						RunAsGroup:               pointer.Int64(1000),
						RunAsNonRoot:             pointer.Bool(true),
						ReadOnlyRootFilesystem:   pointer.Bool(true),
						AllowPrivilegeEscalation: pointer.Bool(false),
					},
					VolumeMounts: []corev1.VolumeMount{
						{Name: "wd", MountPath: "/wd"},
					},
				},
			},
			RestartPolicy:                corev1.RestartPolicyNever,
			ActiveDeadlineSeconds:        pointer.Int64(60 * 60),
			ServiceAccountName:           "markdownplayground",
			AutomountServiceAccountToken: pointer.Bool(false),
			PriorityClassName:            "markdownplayground",
			Volumes: []corev1.Volume{
				{
					Name: "wd",
					VolumeSource: corev1.VolumeSource{
						EmptyDir: &corev1.EmptyDirVolumeSource{},
					},
				},
			},
		},
	}, metav1.CreateOptions{})
	if err != nil && !errors.IsAlreadyExists(err) {
		return err
	}
	return r.waitForPod(ctx, name, func(eventType watch.EventType, pod *corev1.Pod) bool {
		return pod.Status.Phase == corev1.PodRunning
	})
}

func (r *runner) waitForPod(ctx context.Context, name string, predicate func(watch.EventType, *corev1.Pod) bool) error {
	log.Printf("waiting for pod %s \n", name)
	w, err := r.pods.Watch(ctx, metav1.ListOptions{FieldSelector: "metadata.name=" + name})
	if err != nil {
		return err
	}
	defer w.Stop()
	for event := range w.ResultChan() {
		if event.Type == watch.Error {
			return errors.FromObject(event.Object)
		}
		pod := event.Object.(*corev1.Pod)
		if predicate(event.Type, pod) {
			return nil
		}
	}
	return fmt.Errorf("failed to wait for pod")
}

func New() (runners.Interface, error) {
	clientConfig := clientcmd.NewNonInteractiveDeferredLoadingClientConfig(clientcmd.NewDefaultClientConfigLoadingRules(), &clientcmd.ConfigOverrides{})
	config, err := clientConfig.ClientConfig()
	if err != nil {
		return nil, err
	}
	namespace, _, err := clientConfig.Namespace()
	if err != nil {
		return nil, err
	}
	k, err := kubernetes.NewForConfig(config)
	if err != nil {
		return nil, err
	}
	return &runner{
		restConfig: config,
		restClient: k.RESTClient(),
		namespace:  namespace,
		k:          k,
		pods:       k.CoreV1().Pods(namespace),
	}, nil
}
