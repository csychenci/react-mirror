import { scheduleMicroTask } from 'hostConfig';
import { beginWork } from './beginWork';
import {
	commitLayoutEffects,
	commitMutationEffects
} from './commitWork';
import { completeWork } from './completeWork';
import {
	createWorkInProgress,
	FiberNode,
	FiberRootNode,
	PendingPassiveEffects
} from './fiber';
import {
	Flags,
	MutationMask,
	NoFlags,
	PassiveMask
} from './fiberFlags';
import {
	getHighestPriorityLane,
	Lane,
	lanesToSchedulerPriority,
	markRootFinished,
	mergeLanes,
	NoLane,
	SyncLane
} from './fiberLanes';
import {
	flushSyncCallbacks,
	scheduleSyncCallback
} from './syncTaskQueue';
import { HostRoot } from './workTags';
import {
	unstable_scheduleCallback as scheduleCallback,
	unstable_NormalPriority as NormalPriority,
	unstable_shouldYield,
	unstable_cancelCallback
} from 'scheduler';
import { Effect } from './fiberHooks';
import {
	HookHasEffect,
	Passive
} from './hookEffectTags';

let workInProgress: FiberNode | null = null;
let wipRenderLane: Lane = NoLane;
let rootDoesHavePassiveEffect = false;

type RootExitStatus = number;
const RootInComplete = 1;
const RootCompleted = 2;
// 执行过程中报错了

function prepareFreshStack(
	root: FiberRootNode,
	lane: Lane
) {
	root.finishedLane = NoLane;
	root.finishedWork = null;
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
	markRootUpdated(root, lane);
	ensureRootIsScheduled(root);
}

// 调度阶段入口
function ensureRootIsScheduled(
	root: FiberRootNode
) {
	/**
	 * ① 获取最高优先级的 lane
	 */
	const updateLane = getHighestPriorityLane(
		root.pendingLanes
	);
	const existingCallbackNode = root.callbackNode;

	/**
	 * ② 如果最高优先级的 lane 为 NoLane，代表没有 update，则取消之前的调度
	 */
	if (updateLane === NoLane) {
		// 没有 lane 代表没有 update
		if (existingCallbackNode !== null) {
			unstable_cancelCallback(
				existingCallbackNode
			);
			root.callbackNode = null;
			root.callbackPriority = NoLane;
		}
		return;
	}
	const curPriority = updateLane;
	const prevPriority = root.callbackPriority;

	/**
	 * ③ 如果当前优先级与之前相同并且当前有正在调度或执行的任务，则不产生新的调度
	 */
	if (
		curPriority === prevPriority &&
		root.callbackNode !== null
	) {
		return;
	}

	/**
	 * ④ 有更高优先级的任务插入进来了，取消之前的调度
	 */
	if (existingCallbackNode !== null) {
		unstable_cancelCallback(existingCallbackNode);
	}

	// 同步调度不存在 newCallbackNode，只有并发情况下存在
	let newCallbackNode = null;

	if (__DEV__) {
		console.log(
			`在${updateLane === SyncLane ? '微任务' : '宏任务'}中调度优先级：`,
			updateLane
		);
	}

	/**
	 * ⑤ 同步优先级 用微任务调度
	 */
	if (updateLane === SyncLane) {
		// 同步优先级 用微任务调度
		scheduleSyncCallback(
			performSyncWorkOnRoot.bind(null, root)
		);
		scheduleMicroTask(flushSyncCallbacks);
	} else {
		/**
		 * ⑥ 其他优先级 用宏任务调度。schedulerPriority 获取调度器的优先级
		 */
		const schedulerPriority =
			lanesToSchedulerPriority(updateLane);

		/**
		 * ⑦ 用调度器来调度回调函数
		 */
		newCallbackNode = scheduleCallback(
			schedulerPriority,
			performConcurrentWorkOnRoot.bind(null, root)
		);
	}
	root.callbackNode = newCallbackNode;
	root.callbackPriority = curPriority;
}

function markRootUpdated(
	root: FiberRootNode,
	lane: Lane
) {
	root.pendingLanes = mergeLanes(
		root.pendingLanes,
		lane
	);
	console.log(
		'root.pendingLanes',
		root.pendingLanes
	);
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

function performConcurrentWorkOnRoot(
	root: FiberRootNode,
	didTimeout: boolean
): any {
	const curCallback = root.callbackNode;
	/**
	 * ① 执行回调任务之前，需要保证 useEffect 回调执行完
	 */
	const didFlushPassiveEffects =
		flushPassiveEffects(
			root.pendingPassiveEffects
		);
	if (didFlushPassiveEffects) {
		/**
		 * ② 这里代表 useEffect 回调执行了，触发了更新，然后更新的优先级比当前调度的 performConcurrentWorkOnRoot 还要高，也就是说 root.callbackNode 发生了变化，这就代表着有更高优先级的任务插入了进来，当前的任务就不应该在执行下去了
		 */
		if (root.callbackNode !== curCallback) {
			return null;
		}
	}
	const lane = getHighestPriorityLane(
		root.pendingLanes
	);

	const currentCallbackNode = root.callbackNode;
	/**
	 * ③ 防御性编程
	 */
	if (lane === NoLane) {
		return null;
	}
	const needSync =
		lane === SyncLane || didTimeout;
	// render 阶段
	const exitStatus = renderRoot(
		root,
		lane,
		!needSync
	);
	ensureRootIsScheduled(root);
	/**
	 * ④ 如果 render 阶段被中断了，这里需要判断一下 root.callbackNode 是否发生了变化，如果发生了变化，则代表有更高优先级的任务插入了进来，当前的任务就不应该在执行下去了；否则的话，继续调度 performConcurrentWorkOnRoot
	 */
	if (exitStatus === RootInComplete) {
		if (
			root.callbackNode !== currentCallbackNode
		) {
			return null;
		}
		return performConcurrentWorkOnRoot.bind(
			null,
			root
		);
	}
	/**
	 * ⑤ 如果 render 阶段执行完了，我们就可以进入到 commit 阶段了
	 */
	if (exitStatus === RootCompleted) {
		const finishedWork = root.current.alternate;
		root.finishedWork = finishedWork;
		root.finishedLane = lane;
		wipRenderLane = NoLane;
		// wip fiberNode 树以及树中的 flags，执行具体的dom操作
		commitRoot(root);
	} else if (__DEV__) {
		console.warn(
			'还未实现的兵法更新结束状态',
			exitStatus
		);
	}
}

function performSyncWorkOnRoot(
	root: FiberRootNode
) {
	const nextLane = getHighestPriorityLane(
		root.pendingLanes
	);
	if (nextLane !== SyncLane) {
		// 1. 其他比 Synclane 低的优先级
		// 2. NoLane
		ensureRootIsScheduled(root);
		return;
	}
	const exitStatus = renderRoot(
		root,
		nextLane,
		false
	);
	if (exitStatus === RootCompleted) {
		const finishedWork = root.current.alternate;
		root.finishedWork = finishedWork;
		root.finishedLane = nextLane;
		wipRenderLane = NoLane;
		// wip fiberNode 树以及树中的 flags，执行具体的dom操作
		commitRoot(root);
	} else if (__DEV__) {
		console.warn(
			'还未实现同步更新结束状态',
			exitStatus
		);
	}
}

function renderRoot(
	root: FiberRootNode,
	lane: Lane,
	shouldTimeSlice: boolean
) {
	if (__DEV__) {
		console.log(
			`开始${shouldTimeSlice ? '分片' : '同步'}更新`,
			root
		);
	}

	/**
	 * ① 假设当前进来的是同步更新，之前的更新是一个低优先级的异步更新(wipRenderLane)，而当前的 lane 是一个同步的 SyncLane，那么这里就会重新初始化
	 * 重新初始化意味着，workInProgress 会重新创建，它会从根节点开启一个更高优先级的更新；另外一个是，如果它没有被打断的话，那么它会沿用之前的 workInProgress，然后继续执行
	 */
	if (wipRenderLane !== lane) {
		prepareFreshStack(root, lane);
	}

	do {
		try {
			if (shouldTimeSlice) {
				workLoopConcurrent();
			} else {
				workLoopSync();
			}
			break;
		} catch (e) {
			if (__DEV__) {
				console.warn('workLoop发生错误', e);
			}
			workInProgress = null;
		}
	} while (true);

	// 中断执行
	if (
		shouldTimeSlice &&
		workInProgress !== null
	) {
		return RootInComplete;
	}
	// render 阶段执行完成
	if (
		!shouldTimeSlice &&
		workInProgress !== null &&
		__DEV__
	) {
		console.error(
			'render 阶段结束时，workInProgress 不应该为 null'
		);
	}

	return RootCompleted;
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
		console.error(
			'commit 阶段 finishedLane 不应该为 NoLane'
		);
	}

	// 重置
	root.finishedWork = null;
	root.finishedLane = NoLane;
	markRootFinished(root, lane);
	console.log(
		'root.pendingLanes',
		root.pendingLanes,
		lane
	);
	if (
		(finishedWork.flags & PassiveMask) !==
			NoFlags ||
		(finishedWork.subtreeFlags & PassiveMask) !==
			NoFlags
	) {
		// 函数组件存在 需要执行副作用
		if (!rootDoesHavePassiveEffect) {
			rootDoesHavePassiveEffect = true;
			scheduleCallback(NormalPriority, () => {
				// 执行副作用
				flushPassiveEffects(
					root.pendingPassiveEffects
				);
				return;
			});
		}
	}

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
		commitMutationEffects(finishedWork, root);
		// fiber 树切换
		root.current = finishedWork;
		// layout
		commitLayoutEffects(finishedWork, root);
	} else {
		root.current = finishedWork;
	}

	rootDoesHavePassiveEffect = false;
	ensureRootIsScheduled(root);
}

function commitHookEffectList(
	flags: Flags,
	lastEffect: Effect,
	callack: (effect: Effect) => void
) {
	let effect = lastEffect.next as Effect;
	do {
		if ((effect.tag & flags) === flags) {
			callack(effect);
		}
		effect = effect.next as Effect;
	} while (effect !== lastEffect.next);
}

function commitHookEffectListUnmount(
	flags: Flags,
	lastEffect: Effect
) {
	commitHookEffectList(
		flags,
		lastEffect,
		(effect) => {
			const destroy = effect.destroy;
			if (typeof destroy === 'function') {
				destroy();
			}
			effect.tag &= ~HookHasEffect;
		}
	);
}

function commitHookEffectListDestroy(
	flags: Flags,
	lastEffect: Effect
) {
	commitHookEffectList(
		flags,
		lastEffect,
		(effect) => {
			const destroy = effect.destroy;
			if (typeof destroy === 'function') {
				destroy();
			}
		}
	);
}

function commitHookEffectListCreate(
	flags: Flags,
	lastEffect: Effect
) {
	commitHookEffectList(
		flags,
		lastEffect,
		(effect) => {
			const create = effect.create;
			if (typeof create === 'function') {
				effect.destroy = create();
			}
		}
	);
}

function flushPassiveEffects(
	pendingPassiveEffects: PendingPassiveEffects
) {
	let didFlushPassiveEffects = false;
	pendingPassiveEffects.unmount.forEach(
		(effect) => {
			didFlushPassiveEffects = true;
			commitHookEffectListUnmount(
				Passive,
				effect
			);
		}
	);
	pendingPassiveEffects.unmount = [];
	pendingPassiveEffects.update.forEach(
		(effect) => {
			didFlushPassiveEffects = true;
			// 要求不仅是 useEffect 的情况下，还需要标记了 HookHasEffect 的情况下才能触发
			commitHookEffectListDestroy(
				Passive | HookHasEffect,
				effect
			);
		}
	);
	pendingPassiveEffects.update.forEach(
		(effect) => {
			didFlushPassiveEffects = true;
			// 要求不仅是 useEffect 的情况下，还需要标记了 HookHasEffect 的情况下才能触发
			commitHookEffectListCreate(
				Passive | HookHasEffect,
				effect
			);
		}
	);
	pendingPassiveEffects.update = [];
	flushSyncCallbacks();
	return didFlushPassiveEffects;
}

function workLoopSync() {
	while (workInProgress !== null) {
		performUnitOfWork(workInProgress);
	}
}

function workLoopConcurrent() {
	while (
		workInProgress !== null &&
		!unstable_shouldYield()
	) {
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
