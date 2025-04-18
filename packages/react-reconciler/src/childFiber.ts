import { ReactElementType } from 'shared/ReactType';
import {
	createFiberFromElement,
	FiberNode
} from './fiber';
import { REACT_ELEMENT_TYPE } from 'shared/ReactSymbols';
import { HostText } from './workTags';
import { Placement } from './fiberFlags';

function ChildReconciler(
	shouldTrackSideEffects: boolean
) {
	function reconcileSingleElement(
		returnFiber: FiberNode,
		currentFiber: FiberNode | null,
		element: ReactElementType
	) {
		// 根据 element 创建 fiber
		const fiber = createFiberFromElement(element);
		fiber.return = returnFiber;

		return fiber;
	}

	function reconcileSingleTextNode(
		returnFiber: FiberNode,
		currentFiber: FiberNode | null,
		content: string | number
	) {
		const fiber = new FiberNode(
			HostText,
			{ content },
			null
		);
		fiber.return = returnFiber;
		return fiber;
	}

	function placeSingleChild(fiber: FiberNode) {
		if (
			shouldTrackSideEffects &&
			fiber.alternate === null
		) {
			// shouldTrackSideEffects： 应该追逐副作用
			// fiber.alternate === null： 当前是首屏渲染的情况
			fiber.flags = Placement;
		}
		return fiber;
	}

	return function reconcileChildFibers(
		returnFiber: FiberNode,
		currentFiber: FiberNode | null,
		newChild?: ReactElementType
	) {
		if (
			typeof newChild === 'object' &&
			newChild !== null
		) {
			switch (newChild.$$typeof) {
				case REACT_ELEMENT_TYPE:
					return placeSingleChild(
						reconcileSingleElement(
							returnFiber,
							currentFiber,
							newChild
						)
					);
				default:
					if (__DEV__) {
						console.warn(
							'未实现的reconcile类型',
							newChild
						);
					}
					break;
			}
		}

		if (
			typeof newChild === 'string' ||
			typeof newChild === 'number'
		) {
			// 文本节点
			return placeSingleChild(
				reconcileSingleTextNode(
					returnFiber,
					currentFiber,
					newChild
				)
			);
		}

		if (__DEV__) {
			console.warn(
				'未实现的reconcile类型',
				newChild
			);
		}
		return null;
	};
}

export const reconcileChildFibers =
	ChildReconciler(true);
export const mountChildFibers =
	ChildReconciler(false);
