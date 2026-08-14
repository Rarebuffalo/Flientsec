package queue

import (
	"sync"

	"flientsec-agent/policy"
)

const DefaultMaxCapacity = 50

type RetryQueue struct {
	mu          sync.Mutex
	maxCapacity int
	payloads    []policy.CheckRunPayload
}

func NewRetryQueue() *RetryQueue {
	return NewBoundedRetryQueue(DefaultMaxCapacity)
}

func NewBoundedRetryQueue(maxCapacity int) *RetryQueue {
	if maxCapacity <= 0 {
		maxCapacity = DefaultMaxCapacity
	}
	return &RetryQueue{
		maxCapacity: maxCapacity,
		payloads:    make([]policy.CheckRunPayload, 0),
	}
}

func (q *RetryQueue) Push(payload policy.CheckRunPayload) {
	q.mu.Lock()
	defer q.mu.Unlock()

	// If at capacity, evict oldest item to prevent unbounded memory growth
	if len(q.payloads) >= q.maxCapacity {
		q.payloads = q.payloads[1:]
	}
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
