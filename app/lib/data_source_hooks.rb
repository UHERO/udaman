module DataSourceHooks

##  Methods to be called immediately prior to storing data points during a Definition load operation. Each must be
##  an instance method defined in THIS FILE, and must take a single parameter (the new series) and return that
##  series with any mods.

  def update_full_years_top_priority(series)
    top_prio = colleagues.map(&:priority).push(self.priority).max + 1
    self.priority = top_prio  ## don't update/save object! this is only for one run/current scope
    series.no_trim_past.trim(nil, series.get_last_complete_december)
  end

end
