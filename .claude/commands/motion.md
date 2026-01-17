# Animation Setup

Add Framer Motion animations to components.

## Animation Types

### Page Transitions
```tsx
<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  exit={{ opacity: 0, y: -20 }}
  transition={{ duration: 0.3 }}
>
```

### Stagger Children
```tsx
<motion.div variants={container} initial="hidden" animate="show">
  {items.map(item => (
    <motion.div key={item.id} variants={item} />
  ))}
</motion.div>
```

### Scroll Animations
```tsx
<motion.div
  initial={{ opacity: 0 }}
  whileInView={{ opacity: 1 }}
  viewport={{ once: true }}
/>
```

### Gestures
```tsx
<motion.div
  whileHover={{ scale: 1.05 }}
  whileTap={{ scale: 0.95 }}
  drag="x"
  dragConstraints={{ left: 0, right: 100 }}
/>
```

## Usage
```
/motion hero      # Add hero animations
/motion list      # Stagger list items
/motion page      # Page transitions
```

Add animations: $ARGUMENTS
