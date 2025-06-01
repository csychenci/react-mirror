import {
	REACT_ELEMENT_TYPE,
	REACT_FRAGMENT_TYPE
} from 'shared/ReactSymbols';
import {
	Type,
	Key,
	Ref,
	Props,
	ReactElementType,
	ElementType
} from 'shared/ReactType';

const ReactElement = function (
	type: Type,
	key: Key,
	ref: Ref,
	props: Props
): ReactElementType {
	const element = {
		$$typeof: REACT_ELEMENT_TYPE,
		key,
		ref,
		props,
		__mark: 'react.element',
		type
	};
	return element;
};

export const jsx = (
	type: ElementType,
	config: any,
	...maybeChildren: any
) => {
	console.log('config', config);
	let key: Key = null;
	const props: Props = {};
	let ref: Ref = null;
	for (const prop in config) {
		const val = config[prop];
		if (prop === 'key') {
			if (val !== undefined) {
				key = '' + val;
			}
			continue;
		}
		if (prop === 'ref') {
			if (val !== undefined) {
				ref = val;
			}
			continue;
		}
		if ({}.hasOwnProperty.call(config, prop)) {
			props[prop] = val;
		}
	}
	// if (props.children) {
	// 	const childrenLength = props.children.length;
	// 	console.log('maybeChildren', props.children);
	// 	if (childrenLength) {
	// 		if (childrenLength === 1) {
	// 			props.children = props.children[0];
	// 		} else {
	// 			props.children = props.children;
	// 		}
	// 	}
	// }
	const maybeChildrenLength =
		maybeChildren.length;
	console.log('maybeChildren', maybeChildren);
	if (maybeChildrenLength) {
		if (maybeChildrenLength === 1) {
			props.children = maybeChildren[0];
		} else {
			props.children = maybeChildren;
		}
	}
	return ReactElement(type, key, ref, props);
};

export const Fragment = REACT_FRAGMENT_TYPE;

export const jsxDEV = jsx;
