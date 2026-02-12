# FlowLab

### Interactive Max-Flow Visualizer

FlowLab is a web app for building flow diagrams and watching max-flow algorithms run step by step.

## What this app is useful for

- Visualizing how different max-flow algorithms move flow through a network
- Seeing how the **residual graph** changes during each step
- Understanding where a process gets limited by capacity

## Supported algorithms

FlowLab includes an **Algorithm** selector in the control bar.  
You can run the same graph with:

- **Edmonds-Karp** (BFS shortest augmenting paths)
- **Dinic** (level graph phases + blocking flow)
- **Push-Relabel** (local push/relabel operations on excess flow)

All three compute the same final max-flow value on valid graphs, but they differ in how they traverse and update the graph during replay.

## Comparing algorithm behavior

1. Build or load a graph.
2. Select an algorithm from the **Algorithm** dropdown.
3. Run and inspect the **Run Log** and playback highlights.
4. Switch algorithm and rerun to compare event sequence and processing style.

## Main benefit of these algorithms

Max-flow and min-cut algorithms help you find **bottlenecks** in real processes.  
They show which connections are limiting total throughput, so you can decide where to add capacity or redesign the flow.

## Example process questions you can answer

- Which stage is blocking more work from getting through?
- Which edge or handoff is the bottleneck?
- If I increase one capacity, does total output improve?
