class DataList < ActiveRecord::Base
  has_and_belongs_to_many :series
  has_many :data_list_measurements, dependent: :delete_all
  has_many :measurements, -> {distinct}, through: :data_list_measurements
  accepts_nested_attributes_for :measurements

  # def export
  #   
  #   return unless File::exists? save_path_flex 
  #   Dir.mkdir save_path_flex+"_vintages" unless File::directory?(save_path_flex+"_vintages")
  #   filename = save_path_flex.split("/")[-1]
  #   date = Date.today    
  #   FileUtils.cp(save_path_flex, save_path_flex+"_vintages/#{date}_"+filename)
  # end
  def series_names
    if list.nil?
      return []
    end
    list.split("\n").map {|element| element.strip} 
  end
  
  #not to be confused with startdate and enddate
  def start_date
    "#{self.startyear}-01-01"
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

  def get_all_series_data_with_changes(frequency_suffix = 'A', county_switch = 'HI', seasonally_adjusted = 'T')
    puts "seasonally adjusted: #{seasonally_adjusted}"
    series_data = {}
    measurements.each do |m|
      series = m.series
      if seasonally_adjusted == 'T'
        series = series.where("name NOT REGEXP 'NS'") 
      elsif seasonally_adjusted == 'F'
        series = series.where("name REGEXP 'NS'")
      end
      
      series = series.where("name REGEXP '@#{county_switch}.#{frequency_suffix}'")
      
      if series.nil?
        next
      end

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



