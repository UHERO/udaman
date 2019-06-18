module SeriesRelationship
  def all_frequencies
    ### Ugh.... rewrite this with parse_name, etc
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

  ## full recursive tree of dependents
  def Series.all_who_depend_on(name, already_seen = [])
    return [] if already_seen.include?(name)
    already_seen.push(name)
    direct_dependents = Series.who_depends_on(name)
    return [] if direct_dependents.empty?

    all_deps = direct_dependents.dup
    direct_dependents.each do |s_name|
      subtree_deps = Series.all_who_depend_on(s_name, already_seen) ## recursion
      already_seen |= [s_name, subtree_deps].flatten
      all_deps |= subtree_deps
    end
    all_deps
  end

  ## Try to use the above class method directly, if it will save you a model object instantiation.
  ## This is here mainly for some weird notion of OO completeness, or convenience (if your object
  ## already exists anyway)
  def all_who_depend_on_me
    Series.all_who_depend_on(self.name)
  end

  ## the immediate (first order) dependents
  def Series.who_depends_on(name)
    name_match = '[[:<:]]' + name.gsub('%','\%') + '[[:>:]]'
    DataSource
      .where('data_sources.description RLIKE ?', name_match)
      .joins(:series)
      .pluck(:name)
      .uniq
  end

  ## Try to use the above class method directly, if it will save you a model object instantiation.
  ## This is here mainly for some weird notion of OO completeness, or convenience (if your object
  ## already exists anyway)
  def who_depends_on_me
    Series.who_depends_on(self.name)
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
end
