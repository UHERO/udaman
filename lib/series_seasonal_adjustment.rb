module SeriesSeasonalAdjustment
  #may need to spec a test for this in terms of adding the correct source
  def apply_seasonal_adjustment(factor_application)
    ns_series_name = name.sub('@','NS@')  ## replace with call to get_ns_series
    ns_series = Series.get ns_series_name
    raise SeasonalAdjustmentException.new if ns_series.nil?
    set_factors factor_application 
    new_ns_values = ns_series.get_values_after (Date.parse last_demetra_date.to_s)
    adjusted_data = {}
    new_ns_values.each do |date, value|
      factor_month = date.month
      adjusted_data[date] = value - factors[factor_month.to_s] if factor_application == :additive
      adjusted_data[date] = value / factors[factor_month.to_s] if factor_application == :multiplicative
    end
    #still valuable to run as the current series because it sets the seasonal factors
    new_transformation("Applied #{factor_application} Seasonal Adjustment against #{ns_series_name}", adjusted_data)  
  end
  
  def apply_ns_growth_rate_sa
    ns_series = self.name.sub('@','NS@')
    adjusted_series = (ns_series.ts.annualized_percentage_change / 100 + 1) * self.shift_forward_years(1)
    new_transformation("Applied Growth Rate Based Seasonal Adjustment against #{ns_series}", adjusted_series.data)
  end

  def set_factors(factor_application)
    self.factor_application = factor_application
    #should throw in some exception handling if this happens for a non sa series
    ns_series = get_ns_series
    self.factors ||= {}

    last_demetra_date = (self.frequency == 'quarter' or self.frequency == 'Q') ? self.get_last_complete_4th_quarter : self.get_last_complete_december
    self.last_demetra_date = last_demetra_date
    last_year_of_sa_values = get_values_after(last_demetra_date - 1.year, last_demetra_date)
    last_year_of_sa_values.sort.each do |date,sa_value|
      ns_value = ns_series.at(date)
      #puts "#{datestring} - ns:#{ns_value} sa:#{sa_value}"
      #think can just use months for both months and quarters to keep things simple
      factor_month = date.month
      self.factors[factor_month.to_s] = ns_value - sa_value if factor_application == :additive
      self.factors[factor_month.to_s] = ns_value / sa_value if factor_application == :multiplicative
    end
    self.save
  end
end
