"use client";

import React, { useState } from 'react';
import styles from './ExpandableKanban.module.css';

export default function ExpandableKanban({ children, className, isGrid }) {
  const [expandedIndex, setExpandedIndex] = useState(null);
  const childrenArray = React.Children.toArray(children);

  return (
    <div 
      className={`${className || ''} ${isGrid ? (expandedIndex !== null ? styles.gridExpanded : styles.grid) : ''}`}
    >
      {childrenArray.map((child, index) => {
        if (expandedIndex !== null && expandedIndex !== index) return null;

        return (
          <div 
            key={index} 
            className={`${styles.item} ${expandedIndex !== null ? styles.itemExpanded : (isGrid ? styles.itemGrid : '')}`}
          >
            {expandedIndex !== null && (
              <button 
                onClick={(e) => { e.stopPropagation(); setExpandedIndex(null); }}
                className={styles.closeBtn}
              >
                Close View
              </button>
            )}
            {React.cloneElement(child, {
              onClick: expandedIndex === null ? () => setExpandedIndex(index) : undefined,
              style: {
                ...child.props.style,
                flex: 1,
                cursor: expandedIndex === null ? 'pointer' : 'default',
                margin: 0,
                width: '100%',
                maxWidth: 'none'
              }
            })}
          </div>
        );
      })}
    </div>
  );
}
