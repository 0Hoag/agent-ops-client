import { createElement } from 'react';
import { PricingPage } from './PricingPage';
import { pricingPaths } from './paths';

export function createPricingModule() { return { path: pricingPaths.prices, element: createElement(PricingPage) }; }
