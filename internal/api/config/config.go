package config

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

type Config struct {
	EditEnabled bool `json:"editEnabled"`
}

func (config Config) GetConfig(c *gin.Context) {
	c.JSON(http.StatusOK, config)
}
