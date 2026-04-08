import React from 'react';
import { Appointment } from '../../types';

interface FilterBarProps {
  onFilterChange: (filters: FilterOptions) => void;
  appointmentCount: number;
  filteredCount: number;
}

export interface FilterOptions {
  status: Appointment['status'] | 'all';
  dateRange: 'today' | 'week' | 'month' | 'all';
  searchTerm: string;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  onFilterChange,
  appointmentCount,
  filteredCount,
}) => {
  const [filters, setFilters] = React.useState<FilterOptions>({
    status: 'all',
    dateRange: 'all',
    searchTerm: '',
  });

  const handleStatusChange = (status: Appointment['status'] | 'all') => {
    const newFilters = { ...filters, status };
    setFilters(newFilters);
    onFilterChange(newFilters);
  };

  const handleDateRangeChange = (dateRange: 'today' | 'week' | 'month' | 'all') => {
    const newFilters = { ...filters, dateRange };
    setFilters(newFilters);
    onFilterChange(newFilters);
  };

  const handleSearchChange = (searchTerm: string) => {
    const newFilters = { ...filters, searchTerm };
    setFilters(newFilters);
    onFilterChange(newFilters);
  };

  const handleReset = () => {
    const defaultFilters: FilterOptions = {
      status: 'all',
      dateRange: 'all',
      searchTerm: '',
    };
    setFilters(defaultFilters);
    onFilterChange(defaultFilters);
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Search
          </label>
          <input
            type="text"
            placeholder="Search by title or patient ID..."
            value={filters.searchTerm}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Status
          </label>
          <select
            value={filters.status}
            onChange={(e) => handleStatusChange(e.target.value as Appointment['status'] | 'all')}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm"
          >
            <option value="all">All Statuses</option>
            <option value="scheduled">Scheduled</option>
            <option value="confirmed">Confirmed</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Date Range
          </label>
          <select
            value={filters.dateRange}
            onChange={(e) => handleDateRangeChange(e.target.value as 'today' | 'week' | 'month' | 'all')}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm"
          >
            <option value="all">All Dates</option>
            <option value="today">Today</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
          </select>
        </div>

        <div className="flex items-end gap-2">
          <button
            onClick={handleReset}
            className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 font-medium text-sm transition-colors"
          >
            Reset Filters
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between text-sm text-gray-600 bg-gray-50 p-3 rounded-md">
        <span>
          Showing <span className="font-semibold text-gray-900">{filteredCount}</span> of{' '}
          <span className="font-semibold text-gray-900">{appointmentCount}</span> appointments
        </span>
        {filteredCount === 0 && appointmentCount > 0 && (
          <span className="text-amber-600 font-medium">No appointments match your filters</span>
        )}
      </div>
    </div>
  );
};
