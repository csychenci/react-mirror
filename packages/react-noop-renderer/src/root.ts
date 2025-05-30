import {
	createContainer,
	updateContainer
} from 'react-reconciler/src/fiberReconciler';
import {
	Container,
	Instance
} from './hostConfig';
import { ReactElementType } from 'shared/ReactType';
import {
	REACT_ELEMENT_TYPE,
	REACT_FRAGMENT_TYPE
} from 'shared/ReactSymbols';
import * as _Scheduler from 'scheduler';

let idContainer = 0;

export function createRoot() {
	const container: Container = {
		rootID: idContainer++,
		children: []
	};

	// @ts-ignore
	const root = createContainer(container);

	function getChildren(
		parent: Container | Instance
	) {
		if (parent) {
			return parent.children;
		}
		return null;
	}

	function getChildrenAsJsx(root: Container) {
		const children = childToJsx(
			getChildren(root)
		);
		if (Array.isArray(children)) {
			return {
				$$typeof: REACT_ELEMENT_TYPE,
				type: REACT_FRAGMENT_TYPE,
				key: null,
				ref: null,
				props: { children }
			};
		}
		return children;
	}

	function childToJsx(child: any): any {
		// TextInstance
		if (
			typeof child === 'string' ||
			typeof child === 'number'
		) {
			return child;
		}

		// Instance Children
		if (Array.isArray(child)) {
			if (child.length === 0) {
				return null;
			}
			if (child.length === 1) {
				return childToJsx(child[0]);
			}
			const children = child.map(childToJsx);

			if (
				children.every(
					(c) =>
						typeof c === 'string' ||
						typeof c === 'number'
				)
			) {
				return children.join('');
			}
			return children;
		}

		// Instance
		if (Array.isArray(child.children)) {
			const instance = child;
			const children = childToJsx(child.children);
			const props = instance.props;

			if (children !== null) {
				props.children = children;
			}

			return {
				$$typeof: REACT_ELEMENT_TYPE,
				type: instance.type,
				key: null,
				ref: null,
				props: props
			};
		}

		// TextInstance
		return child.text;
	}

	return {
		_Scheduler: _Scheduler,
		render(element: ReactElementType) {
			return updateContainer(element, root);
		},
		getChildren() {
			return getChildren(container);
		},
		getChildrenAsJsx() {
			return getChildrenAsJsx(container);
		}
	};
}
