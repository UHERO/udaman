module SeriesExternalRelationship
  def find_prognoz_data_file
  	pdfs = PrognozDataFile.all
  	pdfs.each do |pdf|
  		return pdf if pdf.series_loaded.include?(self.name) 
  	end
  	nil
  end
  
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
          logger.debug { "aremos_comparison: #{self.name}: #{date}: #{value}, #{self.units_at(date)} diff:#{diff}" } if diff != 0
        end
      end
      self.save if save_series
      return {:missing => self.aremos_missing, :diff => self.aremos_diff}
    rescue => e
      puts e.message
      puts "ERROR WITH \"#{self.name}\".ts.aremos_comparison"
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
  
  def aremos_comp_display_array
    results = []
    begin
      as = AremosSeries.get self.name
      if as.nil?
        return []
      end
      
      as.data.each do |datestring, value|
        data = self.data
        date = datestring.to_date
        unless data[date].nil?
          diff = a_diff(value, self.units_at(date))
          dp = DataPoint.where(:series_id => self.id, :date => date, :current=>true)[0]
          source_code = dp.source_type_code
          logger.debug { "aremos_comp_display_array: #{self.name}: #{datestring}: #{value}, #{self.units_at(date)} diff:#{diff}" } if diff != 0
          results.push(0+source_code) if diff == 0
          results.push(1+source_code) if diff > 0 and diff <= 1.0
          results.push(2+source_code) if diff > 1.0 and diff  <= 10.0
          results.push(3+source_code) if diff > 10.0          
          next #need this. otherwise might add two array elements per diff
        end
        
        if data[date].nil? and value == 1000000000000000.0
          results.push(0)
        else
          results.push(-1)
        end
      end
      results
    rescue => e
      puts e.message
      puts "ERROR WITH \"#{self.name}\".ts.aremos_comparison"
    end
    
  end
  
  def aremos_series
    AremosSeries.get self.name
  end
  
  def aremos_data_side_by_side
    comparison_hash = {}

    as = self.aremos_series
    if as.nil?
      self.data.keys.each {|date| comparison_hash[date] = {:aremos => nil, :udaman=> self.units_at(date)} }
      return comparison_hash
    end

    all_dates = self.data.keys | as.data.keys
    all_dates.each { |date| comparison_hash[date] = {:aremos => as.data[date.strftime('%Y-%m-%d')], :udaman => self.units_at(date)} }
    comparison_hash
  end
  
  def ma_data_side_by_side
    comparison_hash = {}
    ma = self.moving_average
    all_dates = self.data.keys | ma.data.keys
    all_dates.each do |date_string| 
      ma_point = ma.data[date_string].nil? ? nil : ma.data[date_string] 
      residual = ma.data[date_string].nil? ? nil : ma.data[date_string] - self.data[date_string]
      comparison_hash[date_string] = {:ma => ma_point, :udaman => self.data[date_string], :residual => residual } 
    end
    comparison_hash
  end
  
  def data_diff(comparison_data, digits_to_round)
    self.units = 1000 if name[0..2] == 'TGB' #hack for the tax scaling. Should not save units
    cdp = current_data_points.to_a
    diff_hash = {}
    results = []
    comparison_data.each do |date_string, value|      
      # dp = cdp.reject! {|dp| dp.date_string == date_string} # only used for pseudo_history_check
      # dp = dp[0] if dp.class == Array
      dp_val = units_at(date_string)
      
      if dp_val.nil?
        if value.nil?         #no data in series - no data in spreadsheet
          results.push 0
          next
        else                  #data in spreadsheet, but not in series
          results.push 3
          diff_hash[date_string] = nil
          next
        end
      end
            
      dp_idx = cdp.index {|dp| dp.date == date_string }
      dp = dp_idx.nil? ? nil : cdp.delete_at(dp_idx)
      
      if !dp_val.nil? and value.nil? #data in series, no data in spreadsheet
        if dp.pseudo_history?
          results.push 0
        else
          results.push 4
        end
        next
      end
      
      diff = dp_val - value
      
      if diff < 10**-digits_to_round #same data in series and spreadsheet
        results.push 1
      elsif diff <= 0.05 * value #small difference in data in series and spreadsheet 
        results.push 2
        diff_hash[date_string] = diff
      else #large data difference in data in series and spreadsheet | 
        results.push 3
        diff_hash[date_string] = diff
      end
    end
    {:diffs => diff_hash, :display_array => results}
  end
  
  
  
  def find_units
    begin
      unit_options = [1,10,100,1000]
      lowest_diff = nil
      best_unit = nil
    
      unit_options.each do |u|
        self.units = u
        diff = aremos_comparison[:diff]
        if lowest_diff.nil? or diff.abs < lowest_diff
          lowest_diff = diff.abs
          best_unit = u
        end
      end
    
      puts "#{self.name}: SETTING units = #{best_unit}"
      self.units = best_unit
      self.aremos_comparison  
    rescue
      puts "#{self.name}: SETTING DEFAULT"
      self.update_attributes(:units => 1)
    end
  end
end
