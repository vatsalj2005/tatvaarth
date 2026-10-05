import React from 'react';

export interface DiagramNode {
  id: string;
  topic: string;
  parentid?: string;
  isroot?: boolean;
}

export interface DiagramRendererProps {
  type: 'horizontal' | 'vertical';
  nodes: DiagramNode[];
}

const PREMIUM_COLORS = [
  { 
    bg: 'linear-gradient(135deg, #001fa3 0%, #1e40af 100%)',
    shadow: 'rgba(30, 64, 175, 0.6)',
    border: '#1e40af'
  }, // Sapphire
  { 
    bg: 'linear-gradient(135deg, #0d9488 0%, #0f766e 100%)',
    shadow: 'rgba(13, 148, 136, 0.6)',
    border: '#0d9488'
  }, // Emerald/Teal
  { 
    bg: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
    shadow: 'rgba(5, 150, 105, 0.6)',
    border: '#059669'
  }, // Jade
  { 
    bg: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)',
    shadow: 'rgba(124, 58, 237, 0.6)',
    border: '#7c3aed'
  }, // Amethyst/Violet
  { 
    bg: 'linear-gradient(135deg, #c026d3 0%, #86198f 100%)',
    shadow: 'rgba(192, 38, 211, 0.6)',
    border: '#c026d3'
  }, // Fuchsia/Orchid
  { 
    bg: 'linear-gradient(135deg, #e11d48 0%, #be123c 100%)',
    shadow: 'rgba(225, 29, 72, 0.6)',
    border: '#e11d48'
  }, // Ruby/Rose
  { 
    bg: 'linear-gradient(135deg, #ea580c 0%, #c2410c 100%)',
    shadow: 'rgba(234, 88, 12, 0.6)',
    border: '#ea580c'
  }, // Amber/Orange
  { 
    bg: 'linear-gradient(135deg, #b45309 0%, #78350f 100%)',
    shadow: 'rgba(180, 83, 9, 0.6)',
    border: '#b45309'
  }, // Bronze
];

interface TreeNode {
  id: string;
  topic: string;
  children: TreeNode[];
  level?: number;
}

const assignLevels = (node: TreeNode | null, level = 0): void => {
  if (!node) return;
  node.level = level;
  node.children.forEach(child => assignLevels(child, level + 1));
};

const buildTree = (nodes: DiagramNode[]): TreeNode | null => {
  const nodeMap = new Map<string, TreeNode>();
  let root: TreeNode | null = null;

  // Initialize tree nodes
  nodes.forEach(n => {
    nodeMap.set(n.id, { id: n.id, topic: n.topic, children: [] });
  });

  // Connect parents and children
  nodes.forEach(n => {
    const current = nodeMap.get(n.id);
    if (current) {
      if (n.isroot || !n.parentid) {
        if (!root || n.isroot) {
          root = current;
        }
      } else {
        const parent = nodeMap.get(n.parentid);
        if (parent) {
          parent.children.push(current);
        } else {
          // Fallback if parent is missing
          if (!root) root = current;
        }
      }
    }
  });

  return root;
};

const getLevelStyle = (level: number): React.CSSProperties => {
  const color = PREMIUM_COLORS[level % PREMIUM_COLORS.length];
  return {
    background: color.bg,
    borderColor: color.border,
    boxShadow: `0 4px 15px -2px ${color.shadow}, 0 0 10px ${color.shadow}, inset 0 1px 1px rgba(255, 255, 255, 0.3)`,
  };
};

// Recursive horizontal branch renderer
const HorizontalBranch: React.FC<{ node: TreeNode }> = ({ node }) => {
  const nodeStyle = getLevelStyle(node.level ?? 0);
  const isRoot = !node.level || node.level === 0;
  
  const boxClass = isRoot
    ? "px-4 py-2 sm:px-5 sm:py-2.5 rounded-xl text-base sm:text-lg font-bold border text-white min-w-[64px] max-w-[240px] text-center devanagari-safe transition-all duration-300 hover:scale-105 hover:brightness-110 leading-snug shadow-md"
    : "px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-xl text-sm sm:text-base font-semibold border text-white min-w-[52px] max-w-[220px] text-center devanagari-safe transition-all duration-300 hover:scale-105 hover:brightness-110 leading-snug shadow-sm";

  if (node.children.length === 0) {
    return (
      <div className="flex items-center">
        <div className={boxClass} style={nodeStyle}>
          {node.topic}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center">
      {/* Node Box */}
      <div className={`${boxClass} shrink-0`} style={nodeStyle}>
        {node.topic}
      </div>

      {/* Connecting line to the children column */}
      <div className="w-5 h-[2px] bg-foreground shrink-0" />

      {/* Children Column */}
      <div className="flex flex-col relative pl-5 py-0.5">
        {node.children.map((child, idx) => {
          const isFirst = idx === 0;
          const isLast = idx === node.children.length - 1;
          
          return (
            <div key={child.id} className="relative flex items-center py-1.5">
              {node.children.length === 1 ? (
                <div className="absolute -left-5 top-1/2 w-5 h-[2px] bg-foreground -translate-y-1/2" />
              ) : isFirst ? (
                <div className="absolute -left-5 top-1/2 bottom-0 w-5 border-t-2 border-l-2 border-foreground rounded-tl-[6px]" />
              ) : isLast ? (
                <div className="absolute -left-5 top-0 bottom-1/2 w-5 border-b-2 border-l-2 border-foreground rounded-bl-[6px]" />
              ) : (
                <>
                  <div className="absolute -left-5 top-0 bottom-0 w-[2px] bg-foreground" />
                  <div className="absolute -left-5 top-1/2 w-5 h-[2px] bg-foreground -translate-y-1/2" />
                </>
              )}
              <HorizontalBranch node={child} />
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Recursive vertical branch renderer
const VerticalBranch: React.FC<{ node: TreeNode }> = ({ node }) => {
  const nodeStyle = getLevelStyle(node.level ?? 0);
  const isRoot = !node.level || node.level === 0;

  const boxClass = isRoot
    ? "px-4 py-2 sm:px-5 sm:py-2.5 rounded-xl text-base sm:text-lg font-bold border text-white min-w-[64px] max-w-[240px] text-center devanagari-safe transition-all duration-300 hover:scale-105 hover:brightness-110 leading-snug shadow-md"
    : "px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-xl text-sm sm:text-base font-semibold border text-white min-w-[52px] max-w-[220px] text-center devanagari-safe transition-all duration-300 hover:scale-105 hover:brightness-110 leading-snug shadow-sm";

  if (node.children.length === 0) {
    return (
      <div className="flex flex-col items-center">
        <div className={boxClass} style={nodeStyle}>
          {node.topic}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center">
      {/* Node Box */}
      <div className={boxClass} style={nodeStyle}>
        {node.topic}
      </div>

      {/* Connecting line down */}
      <div className="w-[2px] h-4 bg-foreground" />

      {/* Children Row */}
      <div className="flex flex-row justify-center relative pt-4">
        {node.children.map((child, idx) => {
          const isFirst = idx === 0;
          const isLast = idx === node.children.length - 1;

          return (
            <div key={child.id} className="relative flex flex-col items-center px-1.5">
              {node.children.length === 1 ? (
                <div className="absolute top-0 left-1/2 h-4 w-[2px] -translate-y-full -translate-x-1/2 bg-foreground" />
              ) : isFirst ? (
                <div className="absolute right-0 top-0 h-4 w-1/2 -translate-y-full border-t-2 border-l-2 border-foreground rounded-tl-[6px]" />
              ) : isLast ? (
                <div className="absolute left-0 top-0 h-4 w-1/2 -translate-y-full border-t-2 border-r-2 border-foreground rounded-tr-[6px]" />
              ) : (
                <>
                  <div className="absolute top-0 left-0 right-0 h-[2px] bg-foreground -translate-y-[16px]" />
                  <div className="absolute top-0 left-1/2 h-4 w-[2px] bg-foreground -translate-y-full -translate-x-1/2" />
                </>
              )}
              <VerticalBranch node={child} />
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const DiagramRenderer: React.FC<DiagramRendererProps> = ({ type, nodes }) => {
  const nodesStr = React.useMemo(() => JSON.stringify(nodes), [nodes]);

  const root = React.useMemo(() => {
    const r = buildTree(nodes);
    assignLevels(r, 0);
    return r;
  }, [nodesStr]);

  // Check if diagram should be rendered horizontally (either requested, or having many children under any parent)
  const isWide = React.useMemo(() => {
    if (!root) return false;
    let maxChildren = 0;
    let leafCount = 0;
    const check = (node: TreeNode) => {
      if (node.children.length > maxChildren) maxChildren = node.children.length;
      if (node.children.length === 0) leafCount++;
      node.children.forEach(check);
    };
    check(root);
    return maxChildren > 4 || leafCount > 5;
  }, [root]);

  const effectiveType = type === 'horizontal' || isWide ? 'horizontal' : 'vertical';

  const containerRef = React.useRef<HTMLDivElement>(null);
  const contentRef = React.useRef<HTMLDivElement>(null);
  const [scale, setScale] = React.useState(1);
  const [dimensions, setDimensions] = React.useState({ width: 0, height: 0 });

  React.useEffect(() => {
    const updateScale = () => {
      if (containerRef.current && contentRef.current) {
        // Reset scale and position briefly to measure natural dimensions
        const prevTransform = contentRef.current.style.transform;
        const prevPosition = contentRef.current.style.position;
        
        contentRef.current.style.transform = 'none';
        contentRef.current.style.position = 'static';
        
        const containerWidth = Math.max(0, containerRef.current.clientWidth); 
        const rect = contentRef.current.getBoundingClientRect();
        const contentWidth = Math.ceil(rect.width || contentRef.current.scrollWidth);
        const contentHeight = Math.ceil(rect.height || contentRef.current.scrollHeight);

        contentRef.current.style.transform = prevTransform;
        contentRef.current.style.position = prevPosition;

        let newScale = 1;
        if (contentWidth > 0 && containerWidth > 0) {
          const isSmallDevice = containerWidth < 768 || (typeof window !== 'undefined' && window.innerWidth < 768);
          
          if (isSmallDevice) {
            // For small devices: stay within width of the screen AND take as much space as possible
            const targetWidth = Math.max(0, containerWidth - 8);
            newScale = targetWidth / contentWidth;
            // Cap scale at 1.5x so very small diagrams don't blow up excessively
            newScale = Math.min(newScale, 1.5);
          } else {
            // On larger screens: increase base size by 150% (1.5x), scaling down only if it exceeds available width
            const targetWidth = Math.max(0, containerWidth - 24);
            const desiredScale = 1.5;
            if (contentWidth * desiredScale > targetWidth) {
              newScale = Math.max(1.0, targetWidth / contentWidth);
            } else {
              newScale = desiredScale;
            }
          }
        }
        
        setScale(newScale);
        setDimensions({ width: contentWidth, height: contentHeight });
      }
    };

    updateScale();
    window.addEventListener('resize', updateScale);
    
    // Use ResizeObserver on both container and content to detect layout/font changes
    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && containerRef.current && contentRef.current) {
      resizeObserver = new ResizeObserver(() => {
        updateScale();
      });
      resizeObserver.observe(containerRef.current);
      resizeObserver.observe(contentRef.current);
    }

    return () => {
      window.removeEventListener('resize', updateScale);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
    };
  }, [nodesStr, effectiveType]);

  if (!root) {
    return (
      <div className="text-center text-xs text-muted-foreground py-4 border border-dashed border-border rounded-xl">
        त्रुटि: आरेख डेटा लोड करने में असमर्थ (Failed to parse diagram data)
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className="w-full overflow-x-auto my-4 py-2 bg-transparent scrollbar-thin"
    >
      <div 
        style={{
          width: dimensions.width ? `${dimensions.width * scale}px` : 'auto',
          height: dimensions.height ? `${dimensions.height * scale}px` : 'auto',
          position: 'relative',
          margin: '0 auto',
        }}
      >
        <div 
          ref={contentRef}
          className="inline-block py-1 shrink-0"
          style={{ 
            width: 'max-content',
            transform: `scale(${scale})`, 
            transformOrigin: 'top left',
            position: 'absolute',
            left: 0,
            top: 0,
          }}
        >
          {effectiveType === 'horizontal' ? (
            <HorizontalBranch node={root} />
          ) : (
            <VerticalBranch node={root} />
          )}
        </div>
      </div>
    </div>
  );
};

export default DiagramRenderer;
