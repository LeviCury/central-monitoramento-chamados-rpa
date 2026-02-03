import { Calendar, Filter } from 'lucide-react';
import { FilterState, Category } from '../types';

interface FilterPanelProps {
  filters: FilterState;
  categories: Category[];
  onFilterChange: (filters: FilterState) => void;
}

export default function FilterPanel({
  filters,
  categories,
  onFilterChange,
}: FilterPanelProps) {
  const productCategories = categories.filter((c) => c.type === 'product');
  const regionCategories = categories.filter((c) => c.type === 'region');

  const handleCategoryToggle = (categoryName: string) => {
    const newCategories = filters.categories.includes(categoryName)
      ? filters.categories.filter((c) => c !== categoryName)
      : [...filters.categories, categoryName];
    onFilterChange({ ...filters, categories: newCategories });
  };

  const handleRegionToggle = (regionName: string) => {
    const newRegions = filters.regions.includes(regionName)
      ? filters.regions.filter((r) => r !== regionName)
      : [...filters.regions, regionName];
    onFilterChange({ ...filters, regions: newRegions });
  };

  const handleDateChange = (field: 'start' | 'end', value: string) => {
    onFilterChange({
      ...filters,
      dateRange: { ...filters.dateRange, [field]: value },
    });
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center gap-2 mb-6">
        <Filter className="w-5 h-5 text-gray-700" />
        <h2 className="text-lg font-semibold text-gray-900">Filtros</h2>
      </div>

      <div className="space-y-6">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Calendar className="w-4 h-4 text-gray-600" />
            <label className="text-sm font-medium text-gray-700">
              Período
            </label>
          </div>
          <div className="space-y-2">
            <input
              type="date"
              value={filters.dateRange.start}
              onChange={(e) => handleDateChange('start', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
            <input
              type="date"
              value={filters.dateRange.end}
              onChange={(e) => handleDateChange('end', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700 mb-3 block">
            Categorias
          </label>
          <div className="space-y-2">
            {productCategories.map((category) => (
              <label
                key={category.id}
                className="flex items-center gap-2 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={filters.categories.includes(category.name)}
                  onChange={() => handleCategoryToggle(category.name)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">{category.name}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700 mb-3 block">
            Regiões
          </label>
          <div className="space-y-2">
            {regionCategories.map((region) => (
              <label
                key={region.id}
                className="flex items-center gap-2 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={filters.regions.includes(region.name)}
                  onChange={() => handleRegionToggle(region.name)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">{region.name}</span>
              </label>
            ))}
          </div>
        </div>

        <button
          onClick={() =>
            onFilterChange({
              dateRange: { start: '', end: '' },
              categories: [],
              regions: [],
            })
          }
          className="w-full px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
        >
          Limpar Filtros
        </button>
      </div>
    </div>
  );
}
