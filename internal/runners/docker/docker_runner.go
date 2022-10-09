package docker

import (
	"context"
	"fmt"
	"log"

	"github.com/docker/docker/api/types"
	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/filters"
	"github.com/docker/docker/api/types/network"
	"github.com/docker/docker/client"
	"github.com/markdownplayground/markdownplayground/internal/runners"
	v1 "github.com/opencontainers/image-spec/specs-go/v1"
)

/*
The docker executor achieves isolation as follows.

* Each session only gets a single container.
* The container is run without privilege, all caps are dropped, and resource limited to 64Mb and 1 CPU.
* After 10h, the container will exit (if not sooner).

*/

const sessionIDLabel = "markdown-playground/sessionID"

type runner struct{}

func (r runner) Run(ctx context.Context, sessionID, code string) (*runners.RunResult, error) {
	cli, err := client.NewClientWithOpts(client.FromEnv)
	if err != nil {
		return nil, fmt.Errorf("failed to create docker client: %v", err)
	}
	log.Printf("listing containers...")
	containers, err := cli.ContainerList(ctx, types.ContainerListOptions{
		Filters: filters.Args{},
	})
	if err != nil {
		return nil, fmt.Errorf("failed to list containers: %v", err)
	}
	var containerID string
	for _, c := range containers {
		log.Printf("container=%s\n", c.ID)
		if c.Labels[sessionIDLabel] == sessionID {
			containerID = c.ID
		}
	}
	if containerID == "" {
		log.Printf("creating container\n")
		resp, err := cli.ContainerCreate(ctx, &container.Config{
			Cmd:   []string{"sleep", "3600"}, // 10h
			Image: "ubuntu",
			Labels: map[string]string{
				sessionIDLabel: sessionID,
			},
		}, &container.HostConfig{
			AutoRemove:     true,
			CapDrop:        []string{"ALL"},
			Privileged:     false,
			ReadonlyRootfs: false,
			Resources: container.Resources{
				CPUShares: 1000,
				Memory:    6.4e+7, // 64mb
			},
		}, &network.NetworkingConfig{}, &v1.Platform{}, sessionID)
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

func New() runners.Interface {
	return &runner{}
}
