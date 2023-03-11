module SeriesExternalRelationship
   def set_output_series(multiplier)
     self.update_attributes(:mult => multiplier)
   end
  
  def toggle_mult
    self.mult ||= 1
    return set_output_series(1000) if self.mult == 1
    return set_output_series(10) if self.mult == 1000
    set_output_series(1) if self.mult == 10
  end
  
  def a_diff(value, series_value)
    diff_trunc = (value - series_value.aremos_trunc).abs.round(3)
    diff_sig_5 = (value.sig_digits(5).round(3) - series_value.sig_digits(5).round(3)).abs
    diff_sig_6 = (value.sig_digits(6).round(3) - series_value.sig_digits(6).round(3)).abs

    diff_first = diff_trunc < diff_sig_5 ? diff_trunc : diff_sig_5
    diff_second = diff_first < diff_sig_6 ? diff_first : diff_sig_6
        
    diff_second > 0.01 ? diff_second : 0
  end

  # It seems awfully confusing that this class method exists alongside the one above, the two
  # being identical except for an order of mag in the return statement. Is one of them wrong?
  # Do we really need both? -dji
  def Series.a_diff(value, series_value)    
    diff_trunc = (value - series_value.aremos_trunc).abs.round(3)  
    diff_sig_5 = (value.sig_digits(5).round(3) - series_value.sig_digits(5).round(3)).abs
    diff_sig_6 = (value.sig_digits(6).round(3) - series_value.sig_digits(6).round(3)).abs

    diff_first = diff_trunc < diff_sig_5 ? diff_trunc : diff_sig_5
    diff_second = diff_first < diff_sig_6 ? diff_first : diff_sig_6
    
    return diff_second > 0.001 ? diff_second : 0
  end
  
  #no test or spec for this
  def aremos_comparison(save_series = true)
    begin
      as = AremosSeries.get self.name
      if as.nil?
        #puts "NO MATCH: #{self.name}"
        self.aremos_missing = '-1'
        self.save if save_series
        return {:missing => 'No Matching Aremos Series', :diff => 'No Matching Aremos Series'}
      end
      as.data = Hash[as.data.map {|date, value| [Date.strptime(date.to_s, '%Y-%m-%d'), value]}]
      missing_keys = as.data.keys - self.data.keys

      #remove all suppressed values
      missing_keys.delete_if {|key| as.data[key] == 1000000000000000.0}

      self.aremos_missing = missing_keys.count
      self.aremos_diff = 0
      as.data.each do |date, value|
        unless self.data[date].nil?
          #have to do all the rounding because it still seems to suffer some precision errors after initial rounding
          diff = a_diff(value, self.units_at(date))
          self.aremos_diff +=  diff
          #Rails.logger.debug { "aremos_comparison: #{self.name}: #{date}: #{value}, #{self.units_at(date)} diff:#{diff}" } if diff != 0
        end
      end
      self.save if save_series
      return {:missing => self.aremos_missing, :diff => self.aremos_diff}
    rescue => e
      #puts e.message
      #puts "ERROR WITH \"#{self.name}\".ts.aremos_comparison"
    end
  end
  
  def Series.aremos_quick_diff(name, data)
    as = AremosSeries.get name
    aremos_diff = 0
    a_data = as.data
    data.each do |date_string, val|
      
      a_val = a_data[date_string]
      s_val = val #could use units at... might screw up with scale
      #puts "#{name}: #{date_string}: #{a_val}, #{s_val} "
      next if a_val.nil?
      diff = a_diff(a_val, s_val)
      aremos_diff += diff
    end
    return aremos_diff
  end
  
  def aremos_series
    AremosSeries.get self.name
  end
  
end
