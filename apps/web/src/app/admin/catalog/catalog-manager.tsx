'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiRequest } from '@/lib/api';
import { AttributeManager } from './attribute-manager';
import { CategoryManager } from './category-manager';
import type { CatalogCategory, Industry, ProductAttribute } from './catalog-types';

type ActiveTab = 'categories' | 'attributes';

export function CatalogManager() {
  const [industries, setIndustries] = useState<Industry[]>([]);
  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const [attributes, setAttributes] = useState<ProductAttribute[]>([]);
  const [activeTab, setActiveTab] = useState<ActiveTab>('categories');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const [industryItems, categoryItems, attributeItems] = await Promise.all([
        apiRequest<Industry[]>('/catalog/industries'),
        apiRequest<CatalogCategory[]>('/admin/catalog/categories'),
        apiRequest<ProductAttribute[]>('/admin/catalog/attributes'),
      ]);
      setIndustries(industryItems);
      setCategories(categoryItems);
      setAttributes(attributeItems);
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
    ]).then(([industryItems, categoryItems, attributeItems]) => {
      if (active) {
        setIndustries(industryItems);
        setCategories(categoryItems);
        setAttributes(attributeItems);
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
    </div>
    {activeTab === 'categories'
      ? <CategoryManager industries={industries} categories={categories} attributes={attributes} reload={load} />
      : <AttributeManager attributes={attributes} reload={load} />}
  </div>;
}
