import { ChangeEvent, FocusEvent, FunctionComponent, MouseEvent, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import styles from './styles.module.css';
const { v4: uuidv4 } = require('uuid');

export type Box = {
    width: number;
    height: number;
    x: number;
    y: number;
};

export type TextBlock = {
    id: string;
    type: 'text';
    boundingBox: Box;
    text: string;
    fontSize: number;
    fontFamily: string; // TODO We likely want a strict subset of fonts as the backend will only support so many
    color: string;
    align: 'left' | 'right' | 'center';
    verticalAlign: 'top' | 'bottom' | 'center' | 'hanging'; // TODO Is hanging a good name, this is where like the bottom of p's go under the line
    mouseOffsetX?: number;
    mouseOffsetY?: number;
    position?: string | null;
};

type ActionStatus = 'none' | 'drawing' | 'moving' | 'resizing' | 'writing';

const nearPoint = (x: number, y: number, x1: number, y1: number, positionName: string) => {
    return Math.abs(x - x1) < 5 && Math.abs(y - y1) < 5 ? positionName : null;
}

const positionWithinElement = (x: number, y: number, boundingBox: Box): string | null => {
    const topLeft = nearPoint(x, y, boundingBox.x, boundingBox.y, 'top-left');
    const topRight = nearPoint(x, y, boundingBox.x + boundingBox.width, boundingBox.y, 'top-right');
    const bottomLeft = nearPoint(x, y, boundingBox.x, boundingBox.y + boundingBox.height, 'bottom-left');
    const bottomRight = nearPoint(x, y, boundingBox.x + boundingBox.width, boundingBox.y + boundingBox.height, 'bottom-right');
    const inside = x >= boundingBox.x && x <= boundingBox.x + boundingBox.width && y >= boundingBox.y && y <= boundingBox.y + boundingBox.height ? 'inside' : null;
    return topLeft || topRight || bottomLeft || bottomRight || inside;
}

const getElementAtPosition = (x: number, y: number, blocks: Array<TextBlock>): TextBlock | undefined => {
    const mappedResults = blocks.map((block: TextBlock) => {
        const position = positionWithinElement(x, y, block.boundingBox);
        return {...block, position}});
    return mappedResults.find((block: TextBlock) => block.position !== null);
}

const createTextBlock = (x1: number, y1: number, width: number, height: number, text?: string, id?: string): TextBlock => {
    return {
        id: id ? id : uuidv4(),
        type: 'text',
        boundingBox: {
            width: width,
            height: height,
            x: x1,
            y: y1,
        },
        text: text || "",
        fontSize: 24,
        fontFamily: 'Arial',
        color: 'black',
        align: 'left',
        verticalAlign: 'top', 
    }
}

const updateBlock = (id: string, boundingBox: Box, type: TextBlock['type'], blocks: Array<TextBlock>, setBlocks: (blocks: Array<TextBlock>) => void, options?: {[key: string]: any}) => {
    const updatedBlocks = [...blocks];
    switch (type) {
        case 'text':
            // const canvas: any = document.getElementById('certificates-canvas');
            if (options) {
                // const ctx: CanvasRenderingContext2D = canvas.getContext('2d');
                // const textWidth = ctx.measureText(options.text).width;
                // const textHeight = 24;
                const updatedBlocksIndex: number = updatedBlocks.findIndex((block: TextBlock) => block.id === id);
                if(updatedBlocksIndex !== -1) {
                    updatedBlocks[updatedBlocksIndex] = createTextBlock(boundingBox.x, boundingBox.y, boundingBox.width, boundingBox.height, options.text, id);
                }
            }
                break;
        default:
            throw new Error(`Type not recognised: ${type}`);
    }
    setBlocks(updatedBlocks);
}

const adjustElementCoordinates = (boundingBox: Box): Box => {
    // const { x: x1, y1, x2, y2} = block;
    const x2: number = boundingBox.x + boundingBox.width;
    const y2: number = boundingBox.y + boundingBox.height;
    const minX: number = Math.min(boundingBox.x, x2);
    const maxX: number = Math.max(boundingBox.x, x2);
    const minY: number = Math.min(boundingBox.y, y2);
    const maxY: number = Math.max(boundingBox.y, y2);
    return {
        x: minX, 
        y: minY, 
        width: maxX - minX, 
        height: maxY - minY
    };
}

const getTopLeftReize = (x: number, y: number, boundingBox: Box): Box => {
    return {
        x,
        y,
        width: boundingBox.width + (boundingBox.x - x),
        height: boundingBox.height + (boundingBox.y - y),
    }
}

const getTopRightResize = (y: number, boundingBox: Box): Box => {
    return {
        x: boundingBox.x,
        y: y,
        width: boundingBox.width + (boundingBox.y - y),
        height: boundingBox.height + (boundingBox.y - y),
    }
}

const getBottomLeftResize = (x: number, y: number, boundingBox: Box): Box => {
    return {
        x,
        y: boundingBox.y,
        width: boundingBox.width + (boundingBox.x - x),
        height: boundingBox.height + (y - (boundingBox.y + boundingBox.height)),
    }
}

const getBottomRightResize = (x: number, boundingBox: Box) => {
    return {
        x: boundingBox.x,
        y: boundingBox.y,
        width: boundingBox.width + (x - (boundingBox.x + boundingBox.width)),
        height: boundingBox.height + (x - (boundingBox.x + boundingBox.width)),
    }
}

const resizedCoordinates = (x: number, y: number, position: string | null, boundingBox: Box): Box => {
    switch (position) {
        case 'top-left':
            return getTopLeftReize(x, y, boundingBox);
        case "top-right":
            return getTopRightResize(y, boundingBox);
        case "bottom-left":
            return getBottomLeftResize(x, y, boundingBox);
        case "bottom-right":
            return getBottomRightResize(x, boundingBox);
        default:
            return boundingBox;
    }
}

const cursorForPosition = (position?: TextBlock['position']) => {
    if(!position) return 'move';
    switch (position) {
        case 'top-left':
        case 'bottom-right':
            return 'nwse-resize';
        case 'top-right':
        case 'bottom-left':
            return 'nesw-resize';
        default:
            return 'move';
    }
}

const renderTextBlock = (context: CanvasRenderingContext2D, textBlock: TextBlock) => {
    const {
        boundingBox,
        text,
        color,
        fontFamily,
        fontSize: idealFontSize,
        align,
        verticalAlign,
    } = textBlock;

    const testSize = (test: number): boolean => {
        context.font = `${test}px ${textBlock.fontFamily}`;
        const measurements = context.measureText(textBlock.text);
        const width = measurements.width;
        const height = measurements.actualBoundingBoxAscent;
        return width <= textBlock.boundingBox.width && height <= textBlock.boundingBox.height;
    };

    const getMaximumFontSizeThatFits = (attemptFontSize: number): number => {
        // TODO a better default?
        if (attemptFontSize <= 1) {
            return attemptFontSize;
        }
        if (testSize(attemptFontSize)) {
            return attemptFontSize;
        }
        return getMaximumFontSizeThatFits(attemptFontSize - 1);
    };

    const getAlignmentXOffset = (fontSize: number): number => {
        context.font = `${fontSize}px ${fontFamily}`;
        const textWidth = context.measureText(text).width;
        switch (align) {
            case 'left':
                return boundingBox.x;
            case 'center':
                return boundingBox.x + boundingBox.width / 2 - textWidth / 2;
            case 'right':
                return boundingBox.x + boundingBox.width - textWidth;
        }
    };

    const getAlignmentYOffsetAndBaseline = (): { y: number; baseline: CanvasTextBaseline } => {
        switch (verticalAlign) {
            case 'hanging': {
                return { y: boundingBox.y + boundingBox.height, baseline: 'alphabetic' };
            }
            case 'top': {
                return { y: boundingBox.y, baseline: 'hanging' };
            }
            case 'center': {
                context.textBaseline = 'alphabetic';
                const textHeight = context.measureText(text).actualBoundingBoxAscent;
                return {
                    y: boundingBox.y + boundingBox.height / 2 + textHeight / 2,
                    baseline: 'alphabetic',
                };
            }
            case 'bottom': {
                return { y: boundingBox.y + boundingBox.height, baseline: 'bottom' };
            }
        }
    };

    const fontSize = getMaximumFontSizeThatFits(idealFontSize);
    context.font = `${fontSize}px ${fontFamily}`;
    const x = getAlignmentXOffset(fontSize); 
    const { y, baseline } = getAlignmentYOffsetAndBaseline();
    context.textBaseline = baseline;
    context.fillStyle = color;
    context.strokeRect(x, y, boundingBox.width, boundingBox.height);
    context.fillText(text, x, y);
};


const renderBlock = (context: CanvasRenderingContext2D, block: TextBlock) => {
    switch (block.type) {
        case 'text': {
            return renderTextBlock(context, block);
        }
        default:
            throw new Error(`Type not recognised: ${block.type}`);
    }
};

export const DrawingCanvas: FunctionComponent = () => {

    const [ blocks, setBlocks ] = useState<Array<TextBlock>>([]);
    const [ action, setAction ] = useState<ActionStatus>('none');
    const [ selectedTool, setSelectedTool ] = useState<'selection' | 'text'>('text');
    const [ selectedBlock, setSelectedElement ] = useState<TextBlock | null>(null);
    const textAreaRef = useRef<HTMLInputElement>(null);

    useLayoutEffect(() => {
        const canvas: any = document.getElementById('certificates-canvas');
        if (canvas?.getContext) {
            const ctx: CanvasRenderingContext2D = canvas.getContext('2d');
            const image = new Image();
            image.src = '/certificate-background.png';
            ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
            if(blocks.length) {
                ctx.save();
                blocks.forEach((block: TextBlock) => {
                    if(action === 'writing' && selectedBlock?.id === block.id) return;
                    renderBlock(ctx, block);
                });
                ctx.restore();
            }
        }
    }, [action, blocks, selectedBlock?.id, selectedTool]);

    useEffect(() => {
        const textArea = textAreaRef.current;
        if (action === "writing" && textArea) {
            setTimeout(() => {
              textArea.focus();
              textArea.value = selectedBlock?.text || "";
            }, 0);
          }
    }, [action, textAreaRef, selectedBlock, selectedBlock?.id]);

    const resetCanvas = useCallback(() => {
        const canvas: any = document.getElementById('certificates-canvas');
        if (canvas?.getContext) {
            const ctx: CanvasRenderingContext2D = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            setBlocks([]);
            setSelectedElement(null);
        }
    }, []);

    const handleMouseDown = useCallback((event: MouseEvent) => {
        console.log(`event: `, event);
        if(action === 'writing') return;
        const { offsetX, offsetY } = event.nativeEvent;
        if(selectedTool === 'selection') {
            const block: TextBlock | undefined = getElementAtPosition(offsetX, offsetY, blocks);
            if(block){
                const mouseOffsetX: number = offsetX - block.boundingBox.x;
                const mouseOffsetY: number = offsetY - block.boundingBox.y;
                setSelectedElement({...block, mouseOffsetX, mouseOffsetY});
                if(block.position && block.position === 'inside'){
                    setAction('moving');
                }
                else {
                    setAction('resizing');
                }
            }
        } else {
            const block: TextBlock = createTextBlock(offsetX, offsetY, 50, 24);
            setBlocks([...blocks, block]);
            setSelectedElement(block);
            setAction((block.type === 'text') ? 'writing' : 'drawing');
        }
    }, [action, blocks, selectedTool]);

    const handleMouseMove = useCallback((event: MouseEvent) => {
        const { offsetX, offsetY } = event.nativeEvent;

        if(selectedTool === 'selection' && event.target instanceof HTMLElement) {
            const block = getElementAtPosition(offsetX, offsetY, blocks);
            event.target.style.cursor = block ? cursorForPosition(block.position) : 'default';
        }

        if(action === 'drawing' && selectedTool !== 'selection') {
            const id: string = blocks[blocks.length-1].id;
            updateBlock(id, { x: offsetX, y: offsetY, width: blocks[blocks.length-1].boundingBox.width, height: blocks[blocks.length-1].boundingBox.width}, selectedTool, blocks, setBlocks);
        } else if (action === 'moving' && selectedBlock) {
            const { id, type, mouseOffsetX, mouseOffsetY } = selectedBlock;
            const updatedOffsetX: number = (mouseOffsetX) ? offsetX - mouseOffsetX : offsetX;
            const updatedOffsetY: number = (mouseOffsetY) ? offsetY - mouseOffsetY : offsetY;
            updateBlock(id, {x: updatedOffsetX, y: updatedOffsetY, width: selectedBlock.boundingBox.width, height: selectedBlock.boundingBox.height}, type, blocks, setBlocks, { text: selectedBlock.text});
        } else if(action === 'resizing' && selectedBlock) {
            const { id, type, position, boundingBox} = selectedBlock;
            let options = (type === 'text') ? { text: selectedBlock.text} : {};
            const updatedBoundingBox: Box = resizedCoordinates(offsetX, offsetY, position || null, boundingBox);
            updateBlock(id, {x: updatedBoundingBox.x, y: updatedBoundingBox.y, width: updatedBoundingBox.width, height: updatedBoundingBox.height}, type, blocks, setBlocks, options);
        }
    }, [action, blocks, selectedBlock, selectedTool]);

    const handleMouseUp = useCallback((event: any) => {
        const { offsetX, offsetY } = event.nativeEvent;
        if(selectedBlock && selectedBlock.mouseOffsetX && selectedBlock.mouseOffsetY) {
            if(selectedBlock.type === 'text' && offsetX - selectedBlock.mouseOffsetX === selectedBlock.boundingBox.x && offsetY - selectedBlock.mouseOffsetY === selectedBlock.boundingBox.y) {
                setAction('writing');
                return;
            }
            const index: number = blocks.findIndex((block: TextBlock) => block.id === selectedBlock.id);
            if(index !== -1) {
                const {id, type} = blocks[index];
                if( action === 'drawing' || action === 'resizing') {
                   const adjustedBoundingBox: Box = adjustElementCoordinates(blocks[index].boundingBox);
                   updateBlock(id, {x: adjustedBoundingBox.x, y: adjustedBoundingBox.y, width: adjustedBoundingBox.width, height: adjustedBoundingBox.height}, type, blocks, setBlocks);
                }
            }
        }
        if(action !== 'writing') {
            setSelectedElement(null);
            setAction('none');
        }
    }, [action, blocks, selectedBlock]);

    const handleElementSelect = useCallback((event: ChangeEvent<HTMLSelectElement>) => {
        setSelectedTool(event.target.value as TextBlock['type']);
    }, []);

    const handleBlur = useCallback((event: FocusEvent<HTMLInputElement>) => {
        if(selectedBlock) {
            const { id, boundingBox, type } = selectedBlock;
            setSelectedElement(null);
            updateBlock(id, boundingBox, type, blocks, setBlocks, { text: event.target.value });
        }
        setAction('none');
    }, [blocks, selectedBlock]);

    return (
        <section className={styles.drawingCanvasSection}>
            {(action === 'writing' && selectedBlock) ? 
            <div 
                style={{     
                    width: '100%',
                    position: 'absolute', 
                    top: selectedBlock.boundingBox.y - 25, 
                    left: selectedBlock.boundingBox.x, 
                    zIndex: 5,
                }}
            >
                <div style={{ 
                    display: 'flex',
                }}>
                    <span>Font</span>
                    <span>Size</span>
                    <span>Align</span>
                    <span>Colour</span>
                </div>
                <input 
                    id='text-area'
                    ref={textAreaRef} 
                    style={{
                        width: 'fit-content',
                        font: '24px sans-serif',
                        resize: 'none',
                        overflow: 'hidden',
                        whiteSpace: 'pre',
                        background: 'transparent',
                        border: '1px solid black'
                    }} 
                    onBlur={handleBlur} 
            /></div> : null}
            <canvas id="certificates-canvas" className={styles.drawingCanvasContainer} height="500" width="500" onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} >
                Custom certificate
            </canvas>
            <div className={styles.actionButtonRow}>
            <label htmlFor="drawing-element-select" className={styles.drawingElementSelectField}>
                    Action:
                <select id="drawing-element-select" onChange={handleElementSelect}>
                    <option value='text'>Text</option>
                    <option value='selection'>Selection</option>
                </select>
                </label>
                <button onClick={resetCanvas}>Reset</button>
            </div>
        </section>
    );
};
