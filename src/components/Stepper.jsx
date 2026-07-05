// src/components/Stepper.jsx
import { useState } from 'react';

const Stepper = ({ initialValue = 1, onQuantityChange }) => {
  const [quantite, setQuantite] = useState(initialValue);

  const increment = () => {
    const nextValue = quantite + 1;
    setQuantite(nextValue);
    onQuantityChange(nextValue);
  };

  const decrement = () => {
    const nextValue = quantite > 0 ? quantite - 1 : 0;
    setQuantite(nextValue);
    onQuantityChange(nextValue);
  };

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px' }}>
      <button onClick={decrement}>-</button>
      <span>{quantite}</span>
      <button onClick={increment}>+</button>
    </div>
  );
};

export default Stepper;