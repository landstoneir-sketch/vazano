'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiRequest } from '@/lib/api';
import { AttributeManager } from './attribute-manager';
import { CategoryManager } from './category-manager';
import type { CatalogCategory, Industry, ProductAttribute, UnitOfMeasure } from './catalog-types';
import { UnitManager } from './unit-manager';

type ActiveTab = 'categories' | 'attributes' | 'units';

export function CatalogManager() {
  const [industries, setIndustries] = useState<Industry[]>([]);
  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const [attributes, setAttributes] = useState<ProductAttribute[]>([]);
  const [units, setUnits] = useState<UnitOfMeasure[]>([]);
  const [activeTab, setActiveTab] = useState<ActiveTab>('categories');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const [industryItems, categoryItems, attributeItems, unitItems] = await Promise.all([
        apiRequest<Industry[]>('/catalog/industries'),
        apiRequest<CatalogCategory[]>('/admin/catalog/categories'),
        apiRequest<ProductAttribute[]>('/admin/catalog/attributes'),
        apiRequest<UnitOfMeasure[]>('/admin/catalog/units'),
      ]);
      setIndustries(industryItems);
      setCategories(categoryItems);
      setAttributes(attributeItems);
      setUnits(unitItems);
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : 'دریافت اطلاعات کاتالوگ انجام نشد.');
    }
  }, []);

  useEffect(() => {
    let active = true;
    void Promise.all([
      apiRequest<Industry[]>('/catalog/industries'),
      apiRequest<CatalogCategory[]>('/admin/catalog/categories'),
      apiRequest<ProductAttribute[]>('/admin/catalog/attributes'),
      apiRequest<UnitOfMeasure[]>('/admin/catalog/units'),
    ]).then(([industryItems, categoryItems, attributeItems, unitItems]) => {
      if (active) {
        setIndustries(industryItems);
        setCategories(categoryItems);
        setAttributes(attributeItems);
        setUnits(unitItems);
      }
    }).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : 'دریافت اطلاعات کاتالوگ انجام نشد.');
    });
    return () => { active = false; };
  }, []);

  return <div className="stack">
    {error && <div className="message message-error">{error}</div>}
    <div className="tab-list" role="tablist" aria-label="بخش مدیریت کاتالوگ">
      <button className={activeTab === 'categories' ? 'tab-active' : ''} type="button" onClick={() => setActiveTab('categories')}>دسته‌بندی‌ها و اتصال ویژگی‌ها</button>
      <button className={activeTab === 'attributes' ? 'tab-active' : ''} type="button" onClick={() => setActiveTab('attributes')}>تعریف ویژگی‌های محصول</button>
      <button className={activeTab === 'units' ? 'tab-active' : ''} type="button" onClick={() => setActiveTab('units')}>واحدهای اندازه‌گیری</button>
    </div>
    {activeTab === 'categories' && <CategoryManager industries={industries} categories={categories} attributes={attributes} reload={load} />}
    {activeTab === 'attributes' && <AttributeManager attributes={attributes} reload={load} />}
    {activeTab === 'units' && <UnitManager units={units} reload={load} />}
  </div>;
}
