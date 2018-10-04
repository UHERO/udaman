module SeriesRelationship
  def all_frequencies
    s_root = self.name[0..-3]
    f_array = []
    
    %w(A S Q M W D).each do |suffix|
      f_array.push(s_root + '.' + suffix) unless (s_root + '.' + suffix).ts.nil?
    end
    f_array
  end
  
  def other_frequencies
    all_frequencies.reject { |element| self.name == element }
  end
  
  def get_ns_series
    Series.get name.sub('@','NS@')
  end
  
  def current_data_points
    cdp_hash = {}
    cdp_array = []
    self.data_points.where(:current => true).order(:date, updated_at: :desc).all.each do |cdp|
      if cdp_hash[cdp.date]
        cdp.update_attributes!(:current => false)
      else
        cdp_hash[cdp.date] = true
        cdp_array.push cdp
      end
    end
    cdp_array
  end
  
  #does this return ascending or descending
  #pretty sure it's ascending... [0] = low. Not sure if this is the desired behavior
  #probably something to watch out for. but might be locked into some of the front end
  #stuff
  
  #Also need to add in priority
  
  def data_sources_by_last_run
    #data_sources.sort_by(&:last_run)
    data_sources.sort_by { |ds| [ds.priority, ds.last_run ] }
  end

  def clean_data_sources
    sources_in_use = {}
    
    self.current_data_points.each do |dp|
      sources_in_use[dp.data_source_id] ||= 1
    end
    
    #puts sources_in_use.count
    self.data_sources.each do |ds|
      if sources_in_use[ds.id].nil?
        #puts "deleting #{self.name}: #{ds.id} : #{ds.description}"
        ds.delete
      end
    end
    
    self.data_sources.count
  end
  
  def recursive_dependents(already_seen = [])
    return [] if already_seen.include?(self.name)
    already_seen.push(self.name)
    direct_dependents = self.who_depends_on_me
    return [] if direct_dependents.empty?

    all_deps = direct_dependents.dup
    direct_dependents.each do |s_name|
      subtree_deps = s_name.ts.recursive_dependents(already_seen) ## recursion
      already_seen |= [s_name, subtree_deps].flatten
      all_deps |= subtree_deps
    end
    all_deps
  end

  def who_depends_on_me
    name_match = '[[:<:]]' + self.name.gsub('%','\%') + '[[:>:]]'
    DataSource
      .where('data_sources.description RLIKE ? OR eval RLIKE ?', name_match, name_match)
      .joins(:series)
      .pluck(:name)
      .uniq
  end

  def who_i_depend_on(direct_only = false)
    direct_deps = []
    self.data_sources.each do |ds|
      direct_deps |= ds.dependencies
    end
    return direct_deps if direct_only

    second_order_deps = []
    direct_deps.each do |s|
      second_order_deps |= s.ts.who_i_depend_on ## recursion
    end
    direct_deps | second_order_deps
  end
  
  def Series.find_first_order_circular(series_set = Series.get_all_uhero)
    circular_series = []
    series_set.each do |series|
      fod = series.who_i_depend_on(true)
      fod.each do |dep_series|
        begin
          circular_series.push(dep_series) if dep_series.ts.who_i_depend_on(true).include?(series.name)
        rescue
          Rails.logger.error { "THIS BROKE: #{dep_series}, #{series.name} (#{series.id})" }
        end
      end
    end

    potential_problem_ds = []
    circular_series.each do|s_name|
      s_name.ts.data_sources.each do |ds|
        potential_problem_ds.push ds
        puts "#{s_name}: #{ds.id} : #{ds.eval}"
      end
    end
    (potential_problem_ds.sort {|a,b| a.id <=> b.id}).each do |ppd|
      puts "#{ppd.id} : #{ppd.eval}"
    end
    circular_series
  end
  
  def reload_sources(series_worker = false, clear_first = false)
    errors = []
    self.data_sources_by_last_run.each do |ds|
      success = true
      begin
        success = ds.reload_source(clear_first) unless series_worker && !ds.reload_nightly
        errors.push('fail') unless success
      rescue Exception => e
        errors.push("DataSource #{ds.id} for #{self.name} (#{self.id}): #{e.message}")
        Rails.logger.error { "SOMETHING BROKE (#{e.message}) with source #{ds.id} in series #{self.name} (#{self.id})" }
      end
    end
    errors
  end
end
