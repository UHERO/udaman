class Export < ApplicationRecord
  include Cleaning
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

  def replace_all_series(new_s_list)
    my_series = series.includes(:export_series)  ## eager load the bridge table
                      .dup   ## make a copy so that we can modify while looping over
                      .sort_by {|s| s.export_series.find_by!(export_id: id).list_order }
    self.transaction do
      my_series.each do |s|
        ord = new_s_list.index(s.name)
        if ord
          s.export_series.find_by!(export_id: id).update_attributes(list_order: ord)
          new_s_list[ord] = '_done'
        else
          series.delete(s)
        end
      end
      new_s_list.each_with_index do |new, index|
        next if new == '_done'
        series = Series.find_by(universe: 'UHERO', name: new) || raise("Unknown series name #{new}")
        (self.series << series) rescue raise("Series #{new} duplicated?")
        new_es = ExportSeries.find_by(export_id: id, series_id: series.id) ||
            raise('ExportSeries creation failed')  ## 'creation failed' bec previous << operation should have created it
        new_es.update_attributes(list_order: index)
      end
    end
  end

end
