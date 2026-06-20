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

// Recursive horizontal branch renderer
const HorizontalBranch: React.FC<{ 
  node: TreeNode; 
  levelColors: { bg: string; shadow: string; border: string }[]; 
}> = ({ node, levelColors }) => {
  const level = node.level ?? 0;
  const color = levelColors[level] || PREMIUM_COLORS[0];
  const nodeStyle: React.CSSProperties = {
    background: color.bg,
    borderColor: color.border,
    boxShadow: `0 4px 15px -2px ${color.shadow}, 0 0 10px ${color.shadow}, inset 0 1px 1px rgba(255, 255, 255, 0.3)`,
  };
  
  if (node.children.length === 0) {
    return (
      <div className="flex items-center">
        <div 
          className="px-3 py-2 rounded-xl text-xs font-semibold border text-white min-w-[100px] max-w-[150px] text-center devanagari-safe transition-all duration-300 hover:scale-105 hover:brightness-110"
          style={nodeStyle}
        >
          {node.topic}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center">
      {/* Node Box */}
      <div 
        className="px-3 py-2 rounded-xl text-xs font-semibold border text-white min-w-[100px] max-w-[150px] text-center devanagari-safe shrink-0 transition-all duration-300 hover:scale-105 hover:brightness-110"
        style={nodeStyle}
      >
        {node.topic}
      </div>

      {/* Connecting line to the children column */}
      <div className="w-4 h-[2px] bg-foreground shrink-0"></div>

      {/* Children Column */}
      <div className="flex flex-col relative pl-4 py-1">
        {node.children.map((child, idx) => {
          const isFirst = idx === 0;
          const isLast = idx === node.children.length - 1;
          
          return (
            <div key={child.id} className="relative flex items-center py-1">
              {node.children.length === 1 ? (
                // Single child: straight horizontal line
                <div className="absolute -left-4 top-1/2 w-4 h-[2px] bg-foreground -translate-y-1/2" />
              ) : isFirst ? (
                // First child: curves from bottom-left to top-right (border-t + border-l)
                <div className="absolute -left-4 top-1/2 bottom-0 w-4 border-t-2 border-l-2 border-foreground rounded-tl-[8px]" />
              ) : isLast ? (
                // Last child: curves from top-left to bottom-right (border-b + border-l)
                <div className="absolute -left-4 top-0 bottom-1/2 w-4 border-b-2 border-l-2 border-foreground rounded-bl-[8px]" />
              ) : (
                // Middle child: straight vertical line on left + horizontal line to child
                <>
                  <div className="absolute -left-4 top-0 bottom-0 w-[2px] bg-foreground" />
                  <div className="absolute -left-4 top-1/2 w-4 h-[2px] bg-foreground -translate-y-1/2" />
                </>
              )}
              <HorizontalBranch node={child} levelColors={levelColors} />
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Recursive vertical branch renderer
const VerticalBranch: React.FC<{ 
  node: TreeNode; 
  levelColors: { bg: string; shadow: string; border: string }[]; 
}> = ({ node, levelColors }) => {
  const level = node.level ?? 0;
  const color = levelColors[level] || PREMIUM_COLORS[0];
  const nodeStyle: React.CSSProperties = {
    background: color.bg,
    borderColor: color.border,
    boxShadow: `0 4px 15px -2px ${color.shadow}, 0 0 10px ${color.shadow}, inset 0 1px 1px rgba(255, 255, 255, 0.3)`,
  };

  if (node.children.length === 0) {
    return (
      <div className="flex flex-col items-center">
        <div 
          className="px-3 py-2 rounded-xl text-xs font-semibold border text-white min-w-[100px] max-w-[150px] text-center devanagari-safe transition-all duration-300 hover:scale-105 hover:brightness-110"
          style={nodeStyle}
        >
          {node.topic}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center">
      {/* Node Box */}
      <div 
        className="px-3 py-2 rounded-xl text-xs font-semibold border text-white min-w-[100px] max-w-[150px] text-center devanagari-safe transition-all duration-300 hover:scale-105 hover:brightness-110"
        style={nodeStyle}
      >
        {node.topic}
      </div>

      {/* Connecting line down */}
      <div className="w-[2px] h-4 bg-foreground"></div>

      {/* Children Row */}
      <div className="flex flex-row justify-center relative pt-4">
        {node.children.map((child, idx) => {
          const isFirst = idx === 0;
          const isLast = idx === node.children.length - 1;

          return (
            <div key={child.id} className="relative flex flex-col items-center px-1.5">
              {node.children.length === 1 ? (
                // Single child: straight vertical line
                <div className="absolute top-0 left-1/2 h-4 w-[2px] -translate-y-full -translate-x-1/2 bg-foreground" />
              ) : isFirst ? (
                // First child (left): curves from top-right to bottom-center (border-t + border-l)
                <div className="absolute right-0 top-0 h-4 w-1/2 -translate-y-full border-t-2 border-l-2 border-foreground rounded-tl-[8px]" />
              ) : isLast ? (
                // Last child (right): curves from top-left to bottom-center (border-t + border-r)
                <div className="absolute left-0 top-0 h-4 w-1/2 -translate-y-full border-t-2 border-r-2 border-foreground rounded-tr-[8px]" />
              ) : (
                // Middle child: straight horizontal bar + vertical line down
                <>
                  <div className="absolute top-0 left-0 right-0 h-[2px] bg-foreground -translate-y-[16px]" />
                  <div className="absolute top-0 left-1/2 h-4 w-[2px] bg-foreground -translate-y-full -translate-x-1/2" />
                </>
              )}
              <VerticalBranch node={child} levelColors={levelColors} />
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

  const levelColors = React.useMemo(() => {
    // Determine maximum depth of the tree
    const getTreeDepth = (n: TreeNode | null): number => {
      if (!n) return 0;
      if (n.children.length === 0) return 1;
      return 1 + Math.max(...n.children.map(getTreeDepth));
    };
    const depth = getTreeDepth(root);
    
    // Generate a random color for each level
    const colors: { bg: string; shadow: string; border: string }[] = [];
    let prevIndex = -1;
    
    for (let i = 0; i < depth; i++) {
      let availableIndices = PREMIUM_COLORS.map((_, idx) => idx);
      if (prevIndex !== -1 && availableIndices.length > 1) {
        availableIndices = availableIndices.filter(idx => idx !== prevIndex);
      }
      const randomIndex = availableIndices[Math.floor(Math.random() * availableIndices.length)];
      colors.push(PREMIUM_COLORS[randomIndex]);
      prevIndex = randomIndex;
    }
    return colors;
  }, [root]);

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
        const contentWidth = contentRef.current.scrollWidth;
        const contentHeight = contentRef.current.scrollHeight;

        contentRef.current.style.transform = prevTransform;
        contentRef.current.style.position = prevPosition;

        let newScale = 1;
        if (contentWidth > containerWidth && containerWidth > 0) {
          // Add 16px safety buffer (8px on each side) so it doesn't touch screen edges
          const targetWidth = Math.max(0, containerWidth - 16);
          newScale = targetWidth / contentWidth;
          if (newScale < 0.75) {
            newScale = 0.75; // cap minimum scale to keep text readable
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
  }, [nodesStr, type]);

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
      className="w-full overflow-x-auto my-6 py-4 bg-transparent scrollbar-thin"
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
          className="inline-block py-2 shrink-0"
          style={{ 
            width: 'max-content',
            transform: `scale(${scale})`, 
            transformOrigin: 'top left',
            position: 'absolute',
            left: 0,
            top: 0,
          }}
        >
          {type === 'horizontal' ? (
            <HorizontalBranch node={root} levelColors={levelColors} />
          ) : (
            <VerticalBranch node={root} levelColors={levelColors} />
          )}
        </div>
      </div>
    </div>
  );
};

export default DiagramRenderer;
