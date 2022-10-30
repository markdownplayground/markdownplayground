package docker

import (
	"context"
	"fmt"
	"log"
	"os"

	"github.com/docker/docker/api/types"
	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/network"
	"github.com/docker/docker/client"
	"github.com/markdownplayground/markdownplayground/internal/api/term/runners"
	v1 "github.com/opencontainers/image-spec/specs-go/v1"
)

/*
The docker executor achieves isolation as follows.

* Each session only gets a single container.
* The container is run without privilege, all caps are dropped.
* Root file system is read-only.
* CPU limited to 0.5 CPU.
* Memory limited to 64Mb.
* Disk limited to 64Mb.
* After 10h, the container will exit (if not sooner).

*/

const sessionIDLabel = "markdown-playground/session-id"

type runner struct{}

func (r *runner) Reset(ctx context.Context, session runners.Session) error {
	cli, err := client.NewClientWithOpts(client.FromEnv)
	if err != nil {
		return fmt.Errorf("failed to create docker client: %v", err)
	}
	containerID, err := getContainerID(ctx, session, cli)
	if err != nil {
		return fmt.Errorf("failed to get container ID: %v", err)
	}
	if containerID == "" {
		return nil
	}
	err = cli.ContainerRemove(ctx, containerID, types.ContainerRemoveOptions{Force: true})
	if err != nil {
		return fmt.Errorf("failed to remove container: %v", err)
	}
	return nil
}

func (r *runner) Run(ctx context.Context, session runners.Session, code string) (*runners.RunResult, error) {
	cli, err := client.NewClientWithOpts(client.FromEnv)
	if err != nil {
		return nil, fmt.Errorf("failed to create docker client: %v", err)
	}
	containerID, err := getContainerID(ctx, session, cli)
	if err != nil {
		return nil, err
	}
	if containerID == "" {
		var image = "ubuntu"
		if v, ok := os.LookupEnv("DOCKER_IMAGE"); ok {
			image = v
		}
		autoRemove := os.Getenv("DOCKER_AUTO_REMOVE") != "false"
		log.Printf("creating container, image=%s, autoRemove=%v\n", image, autoRemove)
		resp, err := cli.ContainerCreate(ctx, &container.Config{
			Cmd:        []string{"sleep 3600"}, // 1h
			Image:      image,
			WorkingDir: "/wd",
			Entrypoint: []string{"sh", "-c"},
			Labels: map[string]string{
				sessionIDLabel: session,
			},
		}, &container.HostConfig{
			AutoRemove:     autoRemove,
			CapDrop:        []string{"ALL"},
			Privileged:     false,
			ReadonlyRootfs: true,
			Tmpfs: map[string]string{
				"/wd": fmt.Sprintf("size=%.0f", 6.4e+7),
			},
			Resources: container.Resources{
				NanoCPUs: 0.5e+9, // 0.5 CPU
				Memory:   6.4e+7, // 64Mb
			},
		}, &network.NetworkingConfig{}, &v1.Platform{}, session)
		if err != nil {
			return nil, fmt.Errorf("failed to create container: %v", err)
		}
		containerID = resp.ID
	}
	log.Printf("starting containerID=%s\n", containerID)

	if err := cli.ContainerStart(ctx, containerID, types.ContainerStartOptions{}); err != nil {
		return nil, fmt.Errorf("failed to start container: %v", err)
	}
	log.Printf("creating exec...\n")
	exec, err := cli.ContainerExecCreate(ctx, containerID, types.ExecConfig{
		AttachStdin:  true,
		AttachStderr: true,
		AttachStdout: true,
		Tty:          true,
		Cmd:          []string{"sh", "-c", code},
		WorkingDir:   "/wd",
	})
	if err != nil {
		return nil, fmt.Errorf("failed to container exec: %v", err)
	}
	log.Printf("attaching to exec...\n")
	attach, err := cli.ContainerExecAttach(ctx, exec.ID, types.ExecStartCheck{
		Tty: true,
	})
	return &runners.RunResult{
		Closer: attach.Conn,
		Reader: attach.Reader,
	}, nil
}

func getContainerID(ctx context.Context, session runners.Session, cli *client.Client) (string, error) {
	log.Printf("listing containers...")
	containers, err := cli.ContainerList(ctx, types.ContainerListOptions{
		All: true,
	})
	if err != nil {
		return "", fmt.Errorf("failed to list containers: %v", err)
	}
	for _, c := range containers {
		log.Printf("container=%s\n", c.ID)
		if c.Labels[sessionIDLabel] == session {
			return c.ID, nil
		}
	}
	return "", nil
}

func New() runners.Interface {
	return &runner{}
}
