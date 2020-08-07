class DataList < ApplicationRecord
  include Cleaning
  has_and_belongs_to_many :series
  has_many :data_list_measurements, dependent: :delete_all
  has_many :measurements, -> {distinct}, through: :data_list_measurements
  accepts_nested_attributes_for :measurements

  def add_measurement(measurement, list_order = nil, indent = nil)
    return nil if measurements.include?(measurement)
    last_dlm = DataListMeasurement.where(data_list_id: id).order(:list_order).last
    list_order ||= last_dlm ? last_dlm.list_order.to_i + 1 : 0
    indent ||= (last_dlm && last_dlm.indent) || 'indent0'
    self.transaction do
      measurements << measurement
      new_dlm = DataListMeasurement.find_by(data_list_id: id, measurement_id: measurement.id) ||
        raise('DataListMeasurement creation failed')  ## 'creation failed' bec previous << operation should have created it
      new_dlm.update_attributes(list_order: list_order, indent: indent)
    end
    true
  end

  def replace_all_measurements(new_m_list)
    my_measurements = measurements.includes(:data_list_measurements)  ## eager load the bridge table
                                  .dup   ## make a copy so that we can modify while looping over
                                  .sort_by {|m| m.data_list_measurements.where(data_list_id: id).first.list_order }
    self.transaction do
      my_measurements.each do |m|
        ord = new_m_list.index(m.prefix)
        if ord
          m.data_list_measurements.where(data_list_id: id).first.update_attributes(list_order: ord)
          new_m_list[ord] = '_done'
        else
          measurements.delete(m)
        end
      end
      new_m_list.each_with_index do |new, index|
        next if new == '_done'
        meas = Measurement.find_by(universe: 'UHERO', prefix: new) || raise("Unknown measurement prefix #{new}")
        measurements << meas
        new_dlm = DataListMeasurement.find_by(data_list_id: id, measurement_id: meas.id) ||
            raise('DataListMeasurement creation failed')  ## 'creation failed' bec previous << operation should have created it
        new_dlm.update_attributes(list_order: index)
      end
    end
  end

  def series_names
    list.split("\n").map{|e| e.strip } rescue []
  end
  
  #not to be confused with startdate and enddate
  def start_date
    Date.new(startyear).to_s
  end
  
  def series_data
    @series_data ||= get_series_data
  end
  
  def get_series_descriptions 
    series_data = {}
    series_names.each do |s| 
      as = AremosSeries.get(s)
      series_data[s.split('.')[0]] = as.description unless as.nil?
    end
    series_data    
  end
  
  def get_series_ids
    series_data = {}
    series_names.each do |s| 
      series = s.ts
      series_data[s] = series.nil? ? nil : series.id
    end
    series_data    
  end

  def get_sibling_series_ids
    sibling_ids = []
    series_names.each do |s|
      sa_prefix = s[/.*@/].to_s.chomp('@').upcase.chomp('NS').gsub('_', '\\_') + '@'
      sibling_ids += Series.where("name LIKE '#{sa_prefix}%'").pluck :id
      sibling_ids += Series.where("name LIKE '#{sa_prefix.chomp('@') + 'NS@'}%'").pluck :id
    end
    sibling_ids
  end
  
  def get_series_ids_for_frequency(frequency)
    series_data = {}
    series_names.each do |s| 
      s_name = (s.split('.')[0] + '.' + frequency)
      series = s_name.ts
      series_data[s_name] = series.id unless series.nil?
    end
    series_data    
  end
  
  def get_series_data
    series_data = {}
    series_names.each do |s| 
      series = s.ts
      series_data[s] = series.nil? ? {} : series.get_values_after_including(Date.new(startyear))
    end
    series_data
  end

  def get_all_series_data_with_changes(freq, geo, sa)
    series_data = {}
    self.measurements.each do |m|
      filters = ['xseries.frequency = ?', 'geographies.handle = ?']
      values = [Series.frequency_from_code(freq), geo]
      unless sa == 'all'
        filters.push('xseries.seasonal_adjustment = ?')
        values.push(sa)
      end
      where_cond = [filters.join(' and '), values].flatten
      series = m.series.joins(:xseries, :geography).where(where_cond)

      series.each do |s|
        all_changes = {}
        yoy = s.yoy(s.id).data
        ytd = s.ytd(s.id).data
        yoy_diff = s.scaled_yoy_diff(s.id).data
        data = s.scaled_data
        data.keys.sort.each do |date|
          all_changes[date] = {:value => data[date], :yoy => yoy[date], :ytd => ytd[date], :yoy_diff => yoy_diff[date]}
        end
        as = AremosSeries.get(s.name.upcase)
        desc = as.nil? ? '' : as.description
        series_data[s.name] = {:data => all_changes, :id => s.id, :desc => desc}
      end
    end
    series_data
  end
  
  def get_tsd_series_data_with_changes(tsd_file)
    series_data = {}
    series_names.each do |s| 
      as = AremosSeries.get(s.upcase)
      desc = as.nil? ? '' : as.description
      
      url = URI.parse("http://readtsd.herokuapp.com/open/#{tsd_file}/search/#{s.split('.')[0].gsub('%','%25')}/json")
      res = Net::HTTP.new(url.host, url.port).request_get(url.path)
      tsd_data = res.code == '500' ? nil : JSON.parse(res.body)

      if tsd_data.nil?
        series_data[s] = {:data => {}, :id => nil, :desc => desc, :freq => 'M'}
      else
        series = Series.new_transformation(tsd_data['name'] + '.' + tsd_data['frequency'],  tsd_data['data'], Series.frequency_from_code(tsd_data['frequency']))
        all_changes = {}
        yoy = series.yoy.data
        ytd = series.ytd.data
        yoy_diff = series.yoy_diff.data
        data = series.data
        data.keys.sort.each do |date|
          all_changes[date] = {:value => data[date], :yoy => yoy[date], :ytd => ytd[date], :yoy_diff => yoy_diff[date]}
        end
        series_data[s] = {:data => all_changes, :id => nil, :desc => desc, :freq => tsd_data['frequency']}
      end
    end
    series_data
    
  end
  
  def data_dates
    dates_array = []
    series_data.each {|_, data| dates_array |= data.keys}
    dates_array.sort
  end
  
  def DataList.write(name, path, start_date = Date.new(1900))
    t = Time.now
    begin
      names = DataList.find_by!(name: name).series_names
    rescue ActiveRecord::RecordNotFound
      return puts "#{ '%.2f' % (Time.now - t) } | 0 (no list named #{name}) | #{ path }"
    end
    Series.write_data_list names, path, start_date
    puts "#{ '%.2f' % (Time.now - t) } | #{ names.count } | #{ path }"
  end
  
  def DataList.write_tsd(name, path)
    t = Time.now
    names = DataList.where(:name => name).first.series_names
    Series.write_data_list_tsd names, path
    puts "#{ '%.2f' % (Time.now - t) } | #{ names.count } | #{ path }"
  end
end



