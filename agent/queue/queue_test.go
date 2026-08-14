package queue

import (
	"fmt"
	"sync"
	"testing"

	"flientsec-agent/policy"
)

func TestQueuePushAndSize(t *testing.T) {
	q := NewRetryQueue()
	if q.Size() != 0 {
		t.Fatalf("Expected empty queue size 0, got %d", q.Size())
	}

	payload1 := policy.CheckRunPayload{
		ID:     "run-1",
		Status: "PASS",
		Score:  100,
	}
	q.Push(payload1)

	if q.Size() != 1 {
		t.Fatalf("Expected queue size 1, got %d", q.Size())
	}

	payload2 := policy.CheckRunPayload{
		ID:     "run-2",
		Status: "FAIL",
		Score:  60,
	}
	q.Push(payload2)

	if q.Size() != 2 {
		t.Fatalf("Expected queue size 2, got %d", q.Size())
	}
}

func TestQueueFIFOOrdering(t *testing.T) {
	q := NewRetryQueue()

	payloads := []policy.CheckRunPayload{
		{ID: "run-alpha", Status: "PASS", Score: 100},
		{ID: "run-beta", Status: "FAIL", Score: 60},
		{ID: "run-gamma", Status: "WARN", Score: 80},
	}

	for _, p := range payloads {
		q.Push(p)
	}

	popped := q.PopAll()
	if len(popped) != 3 {
		t.Fatalf("Expected 3 popped items, got %d", len(popped))
	}

	// Verify FIFO order
	for i, expected := range payloads {
		if popped[i].ID != expected.ID {
			t.Errorf("Item %d: expected ID %s, got %s", i, expected.ID, popped[i].ID)
		}
		if popped[i].Score != expected.Score {
			t.Errorf("Item %d: expected Score %d, got %d", i, expected.Score, popped[i].Score)
		}
	}

	// Queue must be empty after PopAll
	if q.Size() != 0 {
		t.Fatalf("Expected queue size 0 after PopAll, got %d", q.Size())
	}
}

func TestQueueBoundedCapacity(t *testing.T) {
	// Create small queue with capacity 3
	q := NewBoundedRetryQueue(3)

	q.Push(policy.CheckRunPayload{ID: "run-1", Score: 10})
	q.Push(policy.CheckRunPayload{ID: "run-2", Score: 20})
	q.Push(policy.CheckRunPayload{ID: "run-3", Score: 30})

	if q.Size() != 3 {
		t.Fatalf("Expected size 3, got %d", q.Size())
	}

	// Adding 4th item should evict oldest ("run-1")
	q.Push(policy.CheckRunPayload{ID: "run-4", Score: 40})

	if q.Size() != 3 {
		t.Fatalf("Expected size 3 after eviction, got %d", q.Size())
	}

	popped := q.PopAll()
	if len(popped) != 3 {
		t.Fatalf("Expected 3 items, got %d", len(popped))
	}

	if popped[0].ID != "run-2" || popped[1].ID != "run-3" || popped[2].ID != "run-4" {
		t.Errorf("Unexpected popped sequence after eviction: %+v", popped)
	}
}

func TestQueuePopAllOnEmpty(t *testing.T) {
	q := NewRetryQueue()
	popped := q.PopAll()
	if len(popped) != 0 {
		t.Fatalf("Expected 0 items popped from empty queue, got %d", len(popped))
	}
}

func TestQueueConcurrency(t *testing.T) {
	// Test concurrency with large capacity
	q := NewBoundedRetryQueue(2000)
	const numGoroutines = 50
	const itemsPerGoroutine = 20

	var wg sync.WaitGroup
	wg.Add(numGoroutines)

	for g := 0; g < numGoroutines; g++ {
		go func(gID int) {
			defer wg.Done()
			for i := 0; i < itemsPerGoroutine; i++ {
				q.Push(policy.CheckRunPayload{
					ID:    fmt.Sprintf("goroutine-%d-item-%d", gID, i),
					Score: 100,
				})
			}
		}(g)
	}

	wg.Wait()

	expectedTotal := numGoroutines * itemsPerGoroutine
	if q.Size() != expectedTotal {
		t.Fatalf("Expected queue size %d after concurrent pushes, got %d", expectedTotal, q.Size())
	}

	popped := q.PopAll()
	if len(popped) != expectedTotal {
		t.Fatalf("Expected %d popped items, got %d", expectedTotal, len(popped))
	}

	if q.Size() != 0 {
		t.Fatalf("Expected queue to be empty after PopAll, got %d", q.Size())
	}
}
