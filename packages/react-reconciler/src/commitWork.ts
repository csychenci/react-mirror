import {
	appendChildToContainer,
	commitUpdate,
	Container,
	insertChildToContainer,
	Instance,
	removeChild
} from 'hostConfig';
import {
	FiberNode,
	FiberRootNode,
	PendingPassiveEffects
} from './fiber';
import {
	ChildDeletion,
	Flags,
	LayoutMask,
	MutationMask,
	NoFlags,
	PassiveEffect,
	PassiveMask,
	Placement,
	Ref,
	Update
} from './fiberFlags';
import {
	FunctionComponent,
	HostComponent,
	HostRoot,
	HostText
} from './workTags';
import { FCUpdateQueue } from './fiberHooks';

let nextEffects: FiberNode | null = null;

export const commitEffects = (
	phase: 'mutation' | 'layout',
	mask: Flags,
	callback: (
		fiber: FiberNode,
		root: FiberRootNode
	) => void
) => {
	// 向下遍历
	return (
		finishedWork: FiberNode,
		root: FiberRootNode
	) => {
		nextEffects = finishedWork;
		while (nextEffects !== null) {
			const child: FiberNode | null =
				nextEffects.child;
			if (
				(nextEffects.subtreeFlags & mask) !==
					NoFlags &&
				child !== null
			) {
				nextEffects = child;
			} else {
				// 当前节点不存在 subtreeFlags 或者已经是叶子节点了，向上遍历 DFS
				up: while (nextEffects !== null) {
					callback(nextEffects, root);
					const sibling: FiberNode | null =
						nextEffects.sibling;
					if (sibling !== null) {
						nextEffects = sibling;
						break up;
					}
					nextEffects = nextEffects.return;
				}
			}
		}
	};
};

// export const commitMutationEffects = (
// 	finishedWork: FiberNode,
// 	root: FiberRootNode
// ) => {
// 	// 向下遍历
// 	nextEffects = finishedWork;
// 	while (nextEffects !== null) {
// 		const child: FiberNode | null =
// 			nextEffects.child;
// 		if (
// 			(nextEffects.subtreeFlags &
// 				(MutationMask | PassiveMask)) !==
// 				NoFlags &&
// 			child !== null
// 		) {
// 			nextEffects = child;
// 		} else {
// 			// 当前节点不存在 subtreeFlags 或者已经是叶子节点了，向上遍历 DFS
// 			up: while (nextEffects !== null) {
// 				commitMutationEffectsOnFiber(
// 					nextEffects,
// 					root
// 				);
// 				const sibling: FiberNode | null =
// 					nextEffects.sibling;
// 				if (sibling !== null) {
// 					nextEffects = sibling;
// 					break up;
// 				}
// 				nextEffects = nextEffects.return;
// 			}
// 		}
// 	}
// };

const commitMutationEffectsOnFiber = (
	finishedWork: FiberNode,
	root: FiberRootNode
) => {
	const { flags, tag } = finishedWork;
	if ((flags & Placement) !== NoFlags) {
		commitPlacement(finishedWork);
		finishedWork.flags &= ~Placement; // 从 flags 中移除 Placement
	}
	if ((flags & Update) !== NoFlags) {
		commitUpdate(finishedWork);
		finishedWork.flags &= ~Update; // 从 flags 中移除 Update
	}

	if ((flags & ChildDeletion) !== NoFlags) {
		const deletions = finishedWork.deletions;
		if (deletions !== null) {
			deletions.forEach((childDeletion) => {
				commitDeletion(childDeletion, root);
			});
		}
		finishedWork.flags &= ~ChildDeletion; // 从 flags 中移除 Update
	}

	if ((flags & PassiveEffect) !== NoFlags) {
		commitPassiveEffects(
			finishedWork,
			root,
			'update'
		);
		finishedWork.flags &= ~PassiveEffect;
	}

	if (
		(flags & Ref) !== NoFlags &&
		tag === HostComponent
	) {
		safelyDetachRef(finishedWork);
	}
};

const safelyDetachRef = (current: FiberNode) => {
	const ref = current.ref;
	if (ref !== null) {
		if (typeof ref === 'function') {
			ref(null);
		} else {
			ref.current = null;
		}
	}
};

const safelyAttachRef = (fiber: FiberNode) => {
	const ref = fiber.ref;
	console.log('safelyAttachRef', fiber, ref);
	if (ref !== null) {
		const instance = fiber.stateNode;
		if (typeof ref === 'function') {
			ref(instance);
		} else {
			ref.current = instance;
		}
	}
	console.log('safelyAttachRef end', fiber.ref);
};
const commitLayoutEffectsOnFiber = (
	finishedWork: FiberNode
) => {
	const { flags, tag } = finishedWork;
	console.log(
		'commitLayoutEffectsOnFiber',
		finishedWork,
		flags,
		tag
	);
	if (
		(flags & Ref) !== NoFlags &&
		tag === HostComponent
	) {
		// 绑定新的 ref
		safelyAttachRef(finishedWork);
		finishedWork.flags &= ~Ref;
	}
};

export const commitMutationEffects =
	commitEffects(
		'mutation',
		MutationMask | PassiveMask,
		commitMutationEffectsOnFiber
	);

export const commitLayoutEffects = commitEffects(
	'layout',
	LayoutMask,
	commitLayoutEffectsOnFiber
);

function commitPassiveEffects(
	fiber: FiberNode,
	root: FiberRootNode,
	type: keyof PendingPassiveEffects
) {
	if (
		fiber.tag !== FunctionComponent ||
		(type === 'update' &&
			(fiber.flags & PassiveEffect) === NoFlags)
	) {
		return;
	}
	const updateQueue =
		fiber.updateQueue as FCUpdateQueue<any>;
	if (updateQueue !== null) {
		if (
			updateQueue.lastEffect === null &&
			__DEV__
		) {
			console.error(
				'当 FC 存在 PassiveEffect 时，不应该不存在 effect'
			);
		}
		root.pendingPassiveEffects[type].push(
			updateQueue.lastEffect!
		);
	}
}

function recordHostChildrenToDelete(
	childrenToDelete: FiberNode[],
	unmountFiber: FiberNode
) {
	// 1. 找到第一个 root host 节点
	const lastOne =
		childrenToDelete[childrenToDelete.length - 1];
	if (!lastOne) {
		childrenToDelete.push(unmountFiber);
	} else {
		let node = lastOne.sibling;
		while (node !== null) {
			if (unmountFiber === node) {
				childrenToDelete.push(unmountFiber);
			}
			node = node.sibling;
		}
	}
	// 2. 每找到一个 host 节点，判断下这个节点是不是第一步找到那个节点的兄弟节点
}

function commitDeletion(
	childToDelete: FiberNode,
	root: FiberRootNode
) {
	const rootChildrenToDelete: FiberNode[] = [];
	// 递归子树

	commitNestedComponent(
		childToDelete,
		(unmountFiber) => {
			switch (unmountFiber.tag) {
				case HostComponent:
					// if (rootHostNode === null) {
					// 	rootHostNode = unmountFiber;
					// }
					recordHostChildrenToDelete(
						rootChildrenToDelete,
						unmountFiber
					);
					safelyDetachRef(unmountFiber);
					return;
				case HostText:
					// if (rootHostNode === null) {
					// 	rootHostNode = unmountFiber;
					// }
					recordHostChildrenToDelete(
						rootChildrenToDelete,
						unmountFiber
					);
					return;
				case FunctionComponent:
					commitPassiveEffects(
						unmountFiber,
						root,
						'unmount'
					);
					return;
				default:
					if (__DEV__) {
						console.warn(
							'未处理的 unmount 类型',
							unmountFiber
						);
					}
					break;
			}
		}
	);

	// 移除 rootHostNode 的 DOM
	if (rootChildrenToDelete.length) {
		const hostParent = getHostParent(
			childToDelete
		);
		if (hostParent !== null) {
			rootChildrenToDelete.forEach((child) => {
				removeChild(
					(child as FiberNode).stateNode,
					hostParent
				);
			});
		}
	}

	childToDelete.return = null;
	childToDelete.child = null;
}

function commitNestedComponent(
	root: FiberNode,
	onCommitUnmount: (fiber: FiberNode) => void
) {
	let node = root;
	while (true) {
		onCommitUnmount(node);
		if (node.child !== null) {
			node.child.return = node;
			node = node.child;
			continue;
		}
		if (node === root) {
			// 终止条件
			return;
		}

		while (node.sibling === null) {
			if (
				node.return === null ||
				node.return === root
			) {
				return;
			}
			// 向上归
			node = node.return;
		}
		node.sibling.return = node.return;
		node = node.sibling;
	}
}

const commitPlacement = (
	finishedWork: FiberNode
) => {
	// parent Dom
	// finishedword ~~ Dom
	if (__DEV__) {
		console.warn(
			'执行 Placement 操作',
			finishedWork
		);
	}

	const hostParent = getHostParent(finishedWork);
	const sibling = getHostSibling(finishedWork);
	if (hostParent !== null) {
		insertOrAppendPlacementNodeIntoContainer(
			finishedWork,
			hostParent,
			sibling
		);
	}
};

function getHostSibling(
	fiber: FiberNode
): FiberNode | null {
	let node: FiberNode = fiber;

	findSibling: while (true) {
		while (node.sibling === null) {
			const parent = node.return;
			if (
				parent === null ||
				parent.tag === HostComponent ||
				parent.tag === HostRoot
			) {
				// 没找到
				return null;
			}
			node = parent;
		}
		node.sibling.return = node.return;
		node = node.sibling;

		while (
			node.tag !== HostComponent &&
			node.tag !== HostText
		) {
			// 向下遍历
			if ((node.flags & Placement) !== NoFlags) {
				// 代表这个 sibling 是不稳定的
				continue findSibling;
			}

			if (node.child === null) {
				continue findSibling;
			} else {
				node.child.return = node;
				node = node.child;
			}
		}

		if ((node.flags & Placement) === NoFlags) {
			return node.stateNode;
		}
	}
}

function getHostParent(
	fiber: FiberNode
): Container | null {
	let parent = fiber.return;

	while (parent) {
		const parentTag = parent.tag;
		if (parentTag === HostComponent) {
			return parent.stateNode as Container;
		}
		if (parentTag === HostRoot) {
			return (parent.stateNode as FiberRootNode)
				.container;
		}
		parent = parent.return;
	}

	if (__DEV__) {
		console.warn('未找到 root parent');
	}
	return null;
}

function insertOrAppendPlacementNodeIntoContainer(
	finishedWork: FiberNode,
	hostParent: Container,
	before?: FiberNode | null
) {
	if (
		finishedWork.tag === HostComponent ||
		finishedWork.tag === HostText
	) {
		if (before) {
			insertChildToContainer(
				finishedWork.stateNode,
				hostParent,
				before.stateNode
			);
		} else {
			appendChildToContainer(
				hostParent,
				finishedWork.stateNode
			);
		}
		return;
	}

	const child = finishedWork.child;
	if (child !== null) {
		insertOrAppendPlacementNodeIntoContainer(
			child,
			hostParent
		);
		let sibling = child.sibling;
		while (sibling !== null) {
			insertOrAppendPlacementNodeIntoContainer(
				sibling,
				hostParent
			);
			sibling = sibling.sibling;
		}
	}
}
