class DataPoint < ActiveRecord::Base
  self.primary_keys = :series_id, :date, :created_at, :data_source_id
  belongs_to :series
  belongs_to :data_source
  
  def upd(value, data_source)
    return self             if trying_to_replace_with_nil?(value) #scen 0
    return update_timestamp if same_as_current_data_point?(value, data_source) #scen 1
    prior_dp = nil
    # this one can take a lot of time
    changed = value_or_source_has_changed? value, data_source
    prior_dp = restore_prior_dp(value, data_source) if changed
    return unless prior_dp.nil?
    create_new_dp(value, data_source)         #scen 3
  end
  
  def value_or_source_has_changed?(value, data_source)
    !same_value_as?(value) or self.data_source_id != data_source.id
  end
  
  def same_as_current_data_point?(value,data_source)
    #oddly this used to be data_source.object_id. which makes me think I was dealing with a nil problem
    #in some cases. Hopefully won't crop up.
    same_value_as?(value) and self.data_source_id == data_source.id
  end
  
  def trying_to_replace_with_nil?(value)
     value.nil? and !self.value.nil?
  end
  
  def debug(value)
    puts "#{date} - SELF.VALUE: #{self.value} / #{self.value.class} VALUE: #{value} / #{value.class}"
  end
  
  def create_new_dp(value, data_source)
    #create a new datapoint because value changed
    #need to understand how to control the rounding...not sure what sets this
    #rounding doesnt work, looks like there's some kind of truncation too.
    self.update_attributes(:current => false)
    new_dp = self.dup
    new_dp.update_attributes(
        :series_id => self.series_id,
        :date => self.date,
        :data_source_id => data_source.id,
        :value => value,
        :current => true,
        :created_at => Time.now,
        :updated_at => Time.now
    )
    []
  end
  
  def restore_prior_dp(value, data_source)
    prior_dp = DataPoint.where(:date => date, :series_id => series_id, :value => value, :data_source_id => data_source.id).first
    return nil if prior_dp.nil?
    prior_dp.increment :restore_counter
    current_dp = DataPoint.where(:date => date, :series_id=> series_id, :current=> true).first
    if current_dp.data_source.id == data_source.id
      self.update_attributes(:current => false)
      prior_dp.update_attributes(:current => true)
      return prior_dp
    end
    if data_source.priority >= current_dp.data_source.priority
      current_dp.update_attributes(:current => false)
      prior_dp.update_attributes(:current => true)
    end
    prior_dp
  end
  
  def update_timestamp
    #i wonder why this wouldnt work automatically (timestamp update)
    #updating only is slightly faster than prioring. Over 269 data points the difference is 3.28 v 3.50 seconds
    #this update is not worth it. Just to update the timestamp adds a lot of time to the calculation. It's the 
    #model saving that is expensive
    #self.update_attributes(:updated_at => Time.now)
    self
  end
  
  def same_value_as?(value)
    #used to round to 3 digits but not doing that anymore. May need to revert
    #equality at very last digit (somewhere like 12 or 15) is off if rounding is not used. The find seems to work in MysQL but ruby equality fails
    if self.value.round(10) == value.round(10)
      return true
    end
    series = self.series

    auto_quarantine_toggle = FeatureToggle.find_by(name: 'auto_quarantine') || FeatureToggle.new(status: true)
    if auto_quarantine_toggle.status && (Date.today - 2.years > self.date) && !series.quarantined && !series.restricted
      series.update! quarantined: true
    end
    false
    #self.value == value
  end
  
  def delete
    date = self.date
    series_id = self.series_id
    
    super

    next_of_kin = DataPoint.where(:date => date, :series_id => series_id).sort_by(&:updated_at).reverse[0]
    next_of_kin.update_attributes(:current => true) unless next_of_kin.nil?        
  end
  
  def source_type
    source_eval = self.data_source.eval
    case 
    when source_eval.index('load_from_bls')
      return :download
    when source_eval.index('load_from_download')
      return :download
    when source_eval.index('load_from_fred')
      return :download
    when source_eval.index('load_from')
      return :static_file
    else
      return :identity
    end
  end
  
  # instead of this "is pseudo_history. May want to do something like this periodically"
  # might need to define a pseudohistory task somewhere
  # DataSource.where("eval LIKE '%bls_histextend_date_format_correct.xls%'").each {|ds| ds.mark_as_pseudo_history}
  def is_pseudo_history?
    pseudo_history_sources = %W(
      #{ENV['DATA_PATH']}/rawdata/History/inc_hist.xls
      #{ENV['DATA_PATH']}/rawdata/History/bls_sa_history.xls
      #{ENV['DATA_PATH']}/rawdata/History/bls_histextend_date_format_correct.xls
    )
    source_eval = self.data_source.eval
    pseudo_history_sources.each { |phs| return true if source_eval.index(phs) }
    false
  end

  #this never finishes running. Doesn't seem to catch all the stuff I want either
  # def DataPoint.set_pseudo_history
  #   DataPoint.all.each do |dp|
  #     begin
  #       ph = dp.is_pseudo_history?
  #       dp.update_attributes(:pseudo_history => true) if ph and !dp.pseudo_history
  #       dp.update_attributes(:pseudo_history => false) if !ph and dp.pseudo_history
  #     rescue
  #       puts "error for dp #{dp.id}"
  #     end
  #   end
  #   0
  # end
  
  def source_type_code
    case source_type
    when :download
      return 10
    when :static_file
      return 20
    when :identity
      return 30
    else
      return 40
    end
  end

  def DataPoint.delete_all_created_on(date)
    DataPoint.where("TO_DAYS(created_at) = TO_DAYS('#{date}')").each { |dp| dp.delete }
  end

  def DataPoint.update_public_data_points(series_id = nil)
    t = Time.now
    update_query = %Q(
      update public_data_points p
        join data_points d on d.series_id = p.series_id and d.date = p.date and d.current
        join series s on s.id = d.series_id
      set p.value = d.value,
          p.pseudo_history = d.pseudo_history,
          p.updated_at = d.updated_at
      where not s.quarantined
      and d.updated_at > p.updated_at
      #{' and s.id = ? ' if series_id} ;
    )
    insert_query = %Q(
      insert into public_data_points (series_id, date, value, pseudo_history, created_at, updated_at)
      select d.series_id, d.date, d.value, d.pseudo_history, d.created_at, coalesce(d.updated_at, d.created_at)
      from data_points d
        join series s on s.id = d.series_id
        left join public_data_points p on d.series_id = p.series_id and d.date = p.date
      where not s.quarantined
      and d.current
      and p.created_at is null  /* dp doesn't exist in public_data_points yet */
      #{' and s.id = ? ' if series_id} ;
    )
    delete_query = %Q(
      delete p
      from public_data_points p
        join series s on s.id = p.series_id
        left join data_points d on d.series_id = p.series_id and d.date = p.date and d.current
      where not s.quarantined
      and d.created_at is null  /* dp no longer exists in data_points */
      #{' and s.id = ? ' if series_id} ;
    )
    ActiveRecord::Base.transaction do
      stmt = ActiveRecord::Base.connection.raw_connection.prepare(update_query)
      stmt.execute(series_id)
      stmt.close
      stmt = ActiveRecord::Base.connection.raw_connection.prepare(insert_query)
      stmt.execute(series_id)
      stmt.close
      stmt = ActiveRecord::Base.connection.raw_connection.prepare(delete_query)
      stmt.execute(series_id)
      stmt.close
    end
    if series_id.nil?
      CSV.open('public/rake_time.csv', 'a') do |csv|
        csv << ['update_public_data_points', '%.2f' % (Time.now - t) , t.to_s, Time.now.to_s]
      end
    end
  end

end
