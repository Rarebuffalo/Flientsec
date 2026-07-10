package queue

import (
	"sync"

	"flientsec-agent/policy"
)

type RetryQueue struct {
	mu       sync.Mutex
	payloads []policy.CheckRunPayload
}

func NewRetryQueue() *RetryQueue {
	return &RetryQueue{
		payloads: make([]policy.CheckRunPayload, 0),
	}
}

func (q *RetryQueue) Push(payload policy.CheckRunPayload) {
	q.mu.Lock()
	defer q.mu.Unlock()
	q.payloads = append(q.payloads, payload)
}

func (q *RetryQueue) PopAll() []policy.CheckRunPayload {
	q.mu.Lock()
	defer q.mu.Unlock()
	res := q.payloads
	q.payloads = make([]policy.CheckRunPayload, 0)
	return res
}

func (q *RetryQueue) Size() int {
	q.mu.Lock()
	defer q.mu.Unlock()
	return len(q.payloads)
}
