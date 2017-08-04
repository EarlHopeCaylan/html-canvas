/* @flow */
'use strict';

import type {Background} from './parsing/background';
import type {Border} from './parsing/border';
import type {BorderRadius} from './parsing/borderRadius';
import type {DisplayBit} from './parsing/display';
import type {Float} from './parsing/float';
import type {Font} from './parsing/font';
import type {Overflow} from './parsing/overflow';
import type {Padding} from './parsing/padding';
import type {Position} from './parsing/position';
import type {TextTransform} from './parsing/textTransform';
import type {TextDecoration} from './parsing/textDecoration';
import type {Transform} from './parsing/transform';
import type {Visibility} from './parsing/visibility';
import type {zIndex} from './parsing/zIndex';

import type {Bounds, BoundCurves, Path} from './Bounds';
import type ImageLoader from './ImageLoader';

import type TextContainer from './TextContainer';

import Color from './Color';

import {contains} from './Util';
import {parseBackground} from './parsing/background';
import {parseBorder} from './parsing/border';
import {parseBorderRadius} from './parsing/borderRadius';
import {parseDisplay, DISPLAY} from './parsing/display';
import {parseCSSFloat, FLOAT} from './parsing/float';
import {parseFont} from './parsing/font';
import {parseLetterSpacing} from './parsing/letterSpacing';
import {parseOverflow, OVERFLOW} from './parsing/overflow';
import {parsePadding} from './parsing/padding';
import {parsePosition, POSITION} from './parsing/position';
import {parseTextDecoration} from './parsing/textDecoration';
import {parseTextTransform} from './parsing/textTransform';
import {parseTransform} from './parsing/transform';
import {parseVisibility, VISIBILITY} from './parsing/visibility';
import {parseZIndex} from './parsing/zIndex';

import {parseBounds, parseBoundCurves, calculatePaddingBoxPath} from './Bounds';
import {
    INPUT_BACKGROUND,
    INPUT_BORDERS,
    INPUT_COLOR,
    getInputBorderRadius,
    reformatInputBounds
} from './Input';

type StyleDeclaration = {
    background: Background,
    border: Array<Border>,
    borderRadius: Array<BorderRadius>,
    color: Color,
    display: DisplayBit,
    float: Float,
    font: Font,
    letterSpacing: number,
    opacity: number,
    overflow: Overflow,
    padding: Padding,
    position: Position,
    textDecoration: TextDecoration,
    textTransform: TextTransform,
    transform: Transform,
    visibility: Visibility,
    zIndex: zIndex
};

export default class NodeContainer {
    name: ?string;
    parent: ?NodeContainer;
    style: StyleDeclaration;
    childNodes: Array<TextContainer | Path>;
    bounds: Bounds;
    curvedBounds: BoundCurves;
    image: ?string;

    constructor(node: HTMLElement, parent: ?NodeContainer, imageLoader: ImageLoader) {
        this.parent = parent;
        this.childNodes = [];
        const defaultView = node.ownerDocument.defaultView;
        const style = defaultView.getComputedStyle(node, null);
        const display = parseDisplay(style.display);

        const IS_INPUT = node.type === 'radio' || node.type === 'checkbox';

        this.style = {
            background: IS_INPUT ? INPUT_BACKGROUND : parseBackground(style, imageLoader),
            border: IS_INPUT ? INPUT_BORDERS : parseBorder(style),
            borderRadius:
                (node instanceof defaultView.HTMLInputElement ||
                    node instanceof HTMLInputElement) &&
                IS_INPUT
                    ? getInputBorderRadius(node)
                    : parseBorderRadius(style),
            color: IS_INPUT ? INPUT_COLOR : new Color(style.color),
            display: display,
            float: parseCSSFloat(style.float),
            font: parseFont(style),
            letterSpacing: parseLetterSpacing(style.letterSpacing),
            opacity: parseFloat(style.opacity),
            overflow: parseOverflow(style.overflow),
            padding: parsePadding(style),
            position: parsePosition(style.position),
            textDecoration: parseTextDecoration(style),
            textTransform: parseTextTransform(style.textTransform),
            transform: parseTransform(style),
            visibility: parseVisibility(style.visibility),
            zIndex: parseZIndex(style.zIndex)
        };

        if (this.isTransformed()) {
            // getBoundingClientRect provides values post-transform, we want them without the transformation
            node.style.transform = 'matrix(1,0,0,1,0,0)';
        }

        this.image = getImage(node, imageLoader);
        this.bounds = IS_INPUT ? reformatInputBounds(parseBounds(node)) : parseBounds(node);
        this.curvedBounds = parseBoundCurves(
            this.bounds,
            this.style.border,
            this.style.borderRadius
        );

        if (__DEV__) {
            this.name = `${node.tagName.toLowerCase()}${node.id
                ? `#${node.id}`
                : ''}${node.className.split(' ').map(s => (s.length ? `.${s}` : '')).join('')}`;
        }
    }
    getClipPaths(): Array<Path> {
        const parentClips = this.parent ? this.parent.getClipPaths() : [];
        const isClipped =
            this.style.overflow === OVERFLOW.HIDDEN || this.style.overflow === OVERFLOW.SCROLL;

        return isClipped
            ? parentClips.concat([calculatePaddingBoxPath(this.curvedBounds)])
            : parentClips;
    }
    isInFlow(): boolean {
        return this.isRootElement() && !this.isFloating() && !this.isAbsolutelyPositioned();
    }
    isVisible(): boolean {
        return (
            !contains(this.style.display, DISPLAY.NONE) &&
            this.style.opacity > 0 &&
            this.style.visibility === VISIBILITY.VISIBLE
        );
    }
    isAbsolutelyPositioned(): boolean {
        return this.style.position !== POSITION.STATIC && this.style.position !== POSITION.RELATIVE;
    }
    isPositioned(): boolean {
        return this.style.position !== POSITION.STATIC;
    }
    isFloating(): boolean {
        return this.style.float !== FLOAT.NONE;
    }
    isRootElement(): boolean {
        return this.parent === null;
    }
    isTransformed(): boolean {
        return this.style.transform !== null;
    }
    isPositionedWithZIndex(): boolean {
        return this.isPositioned() && !this.style.zIndex.auto;
    }
    isInlineLevel(): boolean {
        return (
            contains(this.style.display, DISPLAY.INLINE) ||
            contains(this.style.display, DISPLAY.INLINE_BLOCK) ||
            contains(this.style.display, DISPLAY.INLINE_FLEX) ||
            contains(this.style.display, DISPLAY.INLINE_GRID) ||
            contains(this.style.display, DISPLAY.INLINE_LIST_ITEM) ||
            contains(this.style.display, DISPLAY.INLINE_TABLE)
        );
    }
    isInlineBlockOrInlineTable(): boolean {
        return (
            contains(this.style.display, DISPLAY.INLINE_BLOCK) ||
            contains(this.style.display, DISPLAY.INLINE_TABLE)
        );
    }
}

const getImage = (node: HTMLElement, imageLoader: ImageLoader): ?string => {
    switch (node.tagName) {
        case 'IMG':
            // $FlowFixMe
            return imageLoader.loadImage(node.currentSrc || node.src);
        case 'CANVAS':
            // $FlowFixMe
            return imageLoader.loadCanvas(node);
    }

    return null;
};
