class Export < ActiveRecord::Base
  has_many :export_series, dependent: :delete_all
  has_many :series, -> {distinct}, through: :export_series
  accepts_nested_attributes_for :series

  def series_data
    @series_data ||= get_series_data
  end

  def get_series_data
    Hash[series.map{|s| [s.name, s.data]}]
  end

  def data_dates
    dates_array = []
    series_data.each {|_, data| dates_array |= data.keys}
    dates_array.sort
  end
end
