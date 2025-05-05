import {
	appendChildToContainer,
	commitUpdate,
	Container,
	insertChildToContainer,
	removeChild
} from 'hostConfig';
import {
	FiberNode,
	FiberRootNode
} from './fiber';
import {
	ChildDeletion,
	MutationMask,
	NoFlags,
	Placement,
	Update
} from './fiberFlags';
import {
	FunctionComponent,
	HostComponent,
	HostRoot,
	HostText
} from './workTags';

let nextEffects: FiberNode | null = null;

export const commitMutationEffects = (
	finishedWork: FiberNode
) => {
	// 向下遍历
	nextEffects = finishedWork;
	while (nextEffects !== null) {
		const child: FiberNode | null =
			nextEffects.child;
		if (
			(nextEffects.subtreeFlags &
				MutationMask) !==
				NoFlags &&
			child !== null
		) {
			nextEffects = child;
		} else {
			// 当前节点不存在 subtreeFlags 或者已经是叶子节点了，向上遍历 DFS
			up: while (nextEffects !== null) {
				commitMutationEffectsOnFiber(nextEffects);
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

const commitMutationEffectsOnFiber = (
	finishedWork: FiberNode
) => {
	const flags = finishedWork.flags;
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
				commitDeletion(childDeletion);
			});
		}
		finishedWork.flags &= ~ChildDeletion; // 从 flags 中移除 Update
	}
};

function recordHostChildrenToDelete(
	childrenToDelete: FiberNode[],
	unmountFiber: FiberNode
) {
	// 1. 找到第一个 root host 节点
	let lastOne = childrenToDelete[childrenToDelete.length - 1]
	if (!lastOne) {
		childrenToDelete.push(unmountFiber)
	} else {
		let node = lastOne.sibling;
		while (node !== null) {
			if (unmountFiber === node) {
				childrenToDelete.push(unmountFiber)
			}
			node = node.sibling;
		}
	}
	// 2. 每找到一个 host 节点，判断下这个节点是不是第一步找到那个节点的兄弟节点
}

function commitDeletion(
	childToDelete: FiberNode
) {
	const rootChildrenToDelete: FiberNode[] = []
	// 递归子树

	commitNestedComponent(
		childToDelete,
		(unmountFiber) => {
			switch (unmountFiber.tag) {
				case HostComponent:
					// if (rootHostNode === null) {
					// 	rootHostNode = unmountFiber;
					// }
					recordHostChildrenToDelete(rootChildrenToDelete, unmountFiber)
					return;
				case HostText:
					// if (rootHostNode === null) {
					// 	rootHostNode = unmountFiber;
					// }
					recordHostChildrenToDelete(rootChildrenToDelete, unmountFiber)
					return;
				case FunctionComponent:
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
				finishedWork.stateNode,
				hostParent
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
