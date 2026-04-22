import React from 'react';
import Hero from '../../components/shared/Hero';
import ProductShowcase from '../products/Showcase';

const Home = () => {
  return (
    <main className="flex flex-col">
      <Hero />
      <ProductShowcase />
    </main>
  );
};

export default Home;
