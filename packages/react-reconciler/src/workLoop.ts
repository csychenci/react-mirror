import { scheduleMicroTask } from 'hostConfig';
import { beginWork } from './beginWork';
import { commitMutationEffects } from './commitWork';
import { completeWork } from './completeWork';
import {
	createWorkInProgress,
	FiberNode,
	FiberRootNode
} from './fiber';
import {
	MutationMask,
	NoFlags
} from './fiberFlags';
import { getHighestPriorityLane, Lane, markRootFinished, mergeLanes, NoLane, SyncLane } from './fiberLanes';
import { flushSyncCallbacks, scheduleSyncCallback } from './syncTaskQueue';
import { HostRoot } from './workTags';

let workInProgress: FiberNode | null = null;
let wipRenderLane: Lane = NoLane;

function prepareFreshStack(root: FiberRootNode, lane: Lane) {
	workInProgress = createWorkInProgress(
		root.current,
		{}
	);
	wipRenderLane = lane;
}

export function scheduleUpdateOnFiber(
	fiber: FiberNode,
	lane: Lane
) {
	// 调度功能
	const root = markUpdateFromFiberToRoot(fiber);
	markRootUpdated(root, lane)
	ensureRootIsScheduled(root)
}

// 调度阶段入口
function ensureRootIsScheduled(root: FiberRootNode) {
	const updateLane = getHighestPriorityLane(root.pendingLanes)
	if (updateLane === NoLane) {
		// 没有 lane 代表没有 update
		return
	}
	if (updateLane === SyncLane) {
		// 同步优先级 用微任务调度
		if (__DEV__) {
			console.log('在微任务中调度 优先级：', updateLane)
		}
		scheduleSyncCallback(performSyncWorkOnRoot.bind(null, root, updateLane))
		scheduleMicroTask(flushSyncCallbacks)
	} else {
		// 其他优先级 用宏任务调度
	}
}

function markRootUpdated(root: FiberRootNode, lane: Lane) {
	root.pendingLanes = mergeLanes(root.pendingLanes, lane);
}

function markUpdateFromFiberToRoot(
	fiber: FiberNode
) {
	let node = fiber,
		parent = node.return;
	while (parent !== null) {
		// 普通的 fiberNode 节点
		node = parent;
		parent = node.return;
	}
	if (node.tag === HostRoot) {
		return node.stateNode;
	}
	return null;
}

function performSyncWorkOnRoot(root: FiberRootNode, updateLane: Lane) {
	const nextLane = getHighestPriorityLane(root.pendingLanes)
	if (nextLane !== updateLane) {
		// 1. 其他比 Synclane 低的优先级
		// 2. NoLane
		ensureRootIsScheduled(root)
		return
	}
	if (__DEV__) {
		console.warn('render 阶段开始', root.pendingLanes)
	}
	// 初始化
	prepareFreshStack(root, updateLane);

	do {
		try {
			workLoop();
			break;
		} catch (e) {
			if (__DEV__) {
				console.warn('workLoop发生错误', e);
			}
			workInProgress = null;
		}
	} while (true);

	const finishedWork = root.current.alternate;
	root.finishedWork = finishedWork;
	root.finishedLane = updateLane;
	wipRenderLane = NoLane;
	// wip fiberNode 树以及树中的 flags，执行具体的dom操作
	commitRoot(root);
}

function commitRoot(root: FiberRootNode) {
	const finishedWork = root.finishedWork;
	if (finishedWork === null) {
		return;
	}

	if (__DEV__) {
		console.warn('commit 阶段开始', finishedWork);
	}

	const lane = root.finishedLane;

	if (lane === NoLane && __DEV__) {
		console.error('commit 阶段 finishedLane 不应该为 NoLane')
	}

	// 重置
	root.finishedWork = null;
	root.finishedLane = NoLane;
	markRootFinished(root, lane);

	// 判断是否存在3个子阶段需要执行的操作
	// 1. root 的 flags 与 root 的 subtreeFlags 是否包含 MutationMask，包含的话就存在这三个子阶段需要执行的操作
	const subtreeHasFlags =
		(finishedWork.subtreeFlags & MutationMask) !==
		NoFlags;
	const rootHasEffect =
		(finishedWork.flags & MutationMask) !==
		NoFlags;
	if (subtreeHasFlags || rootHasEffect) {
		// beforeMutation
		// Mutation
		commitMutationEffects(finishedWork);
		root.current = finishedWork;
		// layout
	} else {
		root.current = finishedWork;
	}
}

function workLoop() {
	while (workInProgress !== null) {
		performUnitOfWork(workInProgress);
	}
}

function performUnitOfWork(fiber: FiberNode) {
	const next = beginWork(fiber, wipRenderLane);
	fiber.memoizedProps = fiber.pendingProps;

	if (next === null) {
		completeUnitOfWork(fiber);
	} else {
		workInProgress = next;
	}
}

function completeUnitOfWork(fiber: FiberNode) {
	// 遍历兄弟节点
	let node: FiberNode | null = fiber;
	do {
		completeWork(node);
		const sibling = node.sibling;
		if (sibling !== null) {
			workInProgress = sibling;
			return;
		}
		node = node.return;
		workInProgress = node;
	} while (node !== null);
}
