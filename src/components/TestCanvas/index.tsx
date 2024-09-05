export type Dimensions = {
    width: number;
    height: number;
};

export type Box = {
    width: number;
    height: number;
    x: number;
    y: number;
};

export type TextBlock = {
    type: 'text';
    boundingBox: Box;
    text: string;
    fontSize: number;
    fontFamily: string; // TODO We likely want a strict subset of fonts as the backend will only support so many
    color: string;
    align: 'left' | 'right' | 'center';
    verticalAlign: 'top' | 'bottom' | 'center' | 'hanging'; // TODO Is hanging a good name, this is where like the bottom of p's go under the line
};

export type Block = TextBlock;

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
    context.fillText(text, x, y);
};

const renderBlock = (context: CanvasRenderingContext2D, block: Block) => {
    switch (block.type) {
        case 'text': {
            return renderTextBlock(context, block);
        }
    }
    console.warn(`Unknown block type ${block.type}`);
};

export const renderCertificate = ({
    context,
    dimensions,
    background,
    blocks,
}: {
    context: CanvasRenderingContext2D;
    dimensions: Dimensions;
    background: HTMLImageElement;
    blocks: Block[];
}) => {
    context.clearRect(0, 0, dimensions.width, dimensions.height);
    context.drawImage(background, 0, 0, dimensions.width, dimensions.height);
    for (const block of blocks) {
        renderBlock(context, block);
    }
};

export const scaleBlocks = ({
    blocks,
    fromDimensions,
    toDimensions,
}: {
    blocks: Block[];
    fromDimensions: Dimensions;
    toDimensions: Dimensions;
}) => {
    const { height: fromHeight, width: fromWidth } = fromDimensions;
    const { height: toHeight, width: toWidth } = toDimensions;

    const heightRatio = toHeight / fromHeight;
    const widthRatio = toWidth / fromWidth;

    return blocks.map((block): Block => {
        switch (block.type) {
            case 'text': {
                return {
                    ...block,
                    fontSize: block.fontSize * widthRatio,
                    boundingBox: {
                        height: block.boundingBox.height * heightRatio,
                        width: block.boundingBox.width * widthRatio,
                        x: block.boundingBox.x * widthRatio,
                        y: block.boundingBox.y * heightRatio,
                    },
                };
            }
        }
        console.warn(`Unknown block type ${block.type}`);
        return block;
    });
};