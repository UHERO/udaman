class DataPoint < ActiveRecord::Base
  self.primary_keys = :series_id, :date, :created_at, :data_source_id
  belongs_to :series
  belongs_to :data_source
  
  def upd(value, data_source)
    return nil if trying_to_replace_with_nil?(value)
    return nil unless value_or_source_has_changed?(value, data_source)
    restore_prior_dp(value, data_source) || create_new_dp(value, data_source)
  end
  
  def value_or_source_has_changed?(value, data_source)
    !same_value_as?(value) or self.data_source_id != data_source.id
  end

  def trying_to_replace_with_nil?(value)
     value.nil? and !self.value.nil?
  end
  
  def create_new_dp(upd_value, upd_source)
    #create a new datapoint because value or source changed
    #need to understand how to control the rounding...not sure what sets this
    #rounding doesnt work, looks like there's some kind of truncation too.
    return nil if upd_source.priority < self.data_source.priority
    self.update_attributes(:current => false)
    now = Time.now
    new_dp = self.dup
    new_dp.update_attributes(
        :series_id => self.series_id,
        :date => self.date,
        :data_source_id => upd_source.id,
        :value => upd_value,
        :current => true,
        :created_at => now,
        :updated_at => now
    )
    new_dp
  end
  
  def restore_prior_dp(upd_value, upd_source)
    prior_dp = DataPoint.where(series_id: self.series_id,
                               date: self.date,
                               data_source_id: upd_source.id,
                               value: upd_value).first
    return nil if prior_dp.nil?
    unless upd_source.priority < self.data_source.priority
      self.update_attributes(:current => false)
      prior_dp.update_attributes(:current => true)
    end
    prior_dp
  end
  
  def same_value_as?(value)
    #used to round to 3 digits but not doing that anymore. May need to revert
    #equality at very last digit (somewhere like 12 or 15) is off if rounding is not used. The find seems to work in MysQL but ruby equality fails
    if self.value.round(10) == value.round(10)
      return true
    end
    series = self.series

    auto_quarantine = FeatureToggle.is_set('auto_quarantine', true, series.universe)
    if auto_quarantine && (Date.today - 2.years > self.date) && !series.quarantined? && !series.restricted?
      series.add_to_quarantine(false)
    end
    false
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

  def DataPoint.update_public_data_points(universe = 'UHERO', series = nil)
    remove_quarantine = FeatureToggle.is_set('remove_quarantined_from_public', false, universe)
    if series && series.quarantined?
      return true unless remove_quarantine

      begin
        stmt = ActiveRecord::Base.connection.raw_connection.prepare(<<~SQL)
          delete from public_data_points where series_id = ?
        SQL
        stmt.execute(series.id)
        stmt.close
      rescue
          return false
      end
      return true
    end
    t = Time.now
    insert_type = universe == 'NTA' ? 'replace' : 'insert'
    update_query = <<~SQL
      update public_data_points p
        join data_points d on d.series_id = p.series_id and d.date = p.date and d.current
        join series s on s.id = d.series_id
      set p.value = d.value,
          p.pseudo_history = d.pseudo_history,
          p.updated_at = coalesce(d.updated_at, now())
      where p.universe = ?
      and not s.quarantined
      and (d.updated_at is null or d.updated_at > p.updated_at)
      #{' and s.id = ? ' if series} ;
    SQL
    insert_query = <<~SQL
      #{insert_type} into public_data_points (universe, series_id, `date`, `value`, pseudo_history, created_at, updated_at)
      select d.universe, d.series_id, d.date, d.value, d.pseudo_history, d.created_at, coalesce(d.updated_at, d.created_at)
      from data_points d
        join series s on s.id = d.series_id
        left join public_data_points p on d.series_id = p.series_id and d.date = p.date
      where d.universe = ?
      and not s.quarantined
      and d.current
      and p.created_at is null  /* dp doesn't exist in public_data_points yet */
      #{' and s.id = ? ' if series} ;
    SQL
    delete_query = <<~SQL
      delete p
      from public_data_points p
        join series s on s.id = p.series_id
        left join data_points d on d.series_id = p.series_id and d.date = p.date and d.current
      where p.universe = ?
      and( d.created_at is null  /* dp no longer exists in data_points */
           #{'or s.quarantined' if remove_quarantine} )
      #{' and s.id = ? ' if series} ;
    SQL
    begin
      ActiveRecord::Base.transaction do
        stmt = ActiveRecord::Base.connection.raw_connection.prepare(update_query)
        series ? stmt.execute(universe, series.id) : stmt.execute(universe)
        stmt.close
        stmt = ActiveRecord::Base.connection.raw_connection.prepare(insert_query)
        series ? stmt.execute(universe, series.id) : stmt.execute(universe)
        stmt.close
        stmt = ActiveRecord::Base.connection.raw_connection.prepare(delete_query)
        series ? stmt.execute(universe, series.id) : stmt.execute(universe)
        stmt.close
      end
    rescue
        return false
    end
    if series.nil?
      CSV.open('public/rake_time.csv', 'a') do |csv|
        csv << ['update_public_data_points', '%.2f' % (Time.now - t) , t.to_s, Time.now.to_s]
      end
    end
    true
  end

end
