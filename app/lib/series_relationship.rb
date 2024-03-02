module SeriesRelationship
  def all_frequencies(exclude_self: false)
    sibs = []
    mycode = Series.code_from_frequency(self.frequency)
    %w(A S Q M W D).each do |code|
      next if exclude_self && code == mycode
      sib_series = find_sibling_for_freq(code)
      sibs.push(sib_series) if sib_series
    end
    sibs
  end
  
  def other_frequencies
    all_frequencies(exclude_self: true)
  end
  
  def loaders_by_last_run
    enabled_loaders.sort_by {|d| [d.priority, d.last_run ] }
  end

  ## full recursive tree of dependents
  ##   THIS IS NOT RELATIVIZED FOR DIFFERENT UNIVERSES, BUT PROB OK JUST UHERO FOR NOW
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

  ## Only the immediate (first order) dependents
  # Why does this match against description rather than dependencies? Because sometimes the dependency is implicit
  # or hidden in the load statement code (perhaps inside a method call like apply_ns_growth_rate_sa), rather than
  # explicitly given in the load statement itself.
  def Series.who_depends_on(name, attrs = [:name], universe = 'UHERO')
    name_match = '[[:<:]]' + name.gsub('%','\%') + '[[:>:]]'
    Loader
      .where('loaders.universe = ? and loaders.description RLIKE ?', universe, name_match)
      .joins(:series)
      .pluck(*attrs)
      .uniq
  end

  ## Try to use the above class method directly, if it will save you a model object instantiation.
  ## This is here mainly for some weird notion of OO completeness, or convenience (if your object
  ## already exists anyway)
  def who_depends_on_me(attrs = [:name])
    Series.who_depends_on(self.name, attrs, self.universe)
  end

  def who_i_depend_on(direct_only = false)
    direct_deps = []
    enabled_loaders.each do |ds|
      direct_deps |= ds.dependencies
    end
    return direct_deps if direct_only

    second_order_deps = []
    direct_deps.each do |s|
      second_order_deps |= s.tsnil.who_i_depend_on rescue Rails.logger.warn("Nonexisting dependency found: #{s}") ## recursion
    end
    direct_deps | second_order_deps
  end
end
