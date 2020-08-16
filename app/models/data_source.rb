class DataSource < ApplicationRecord
  include Cleaning
  include DataSourceHooks
  extend Validators
  require 'digest/md5'
  serialize :dependencies, Array
  
  belongs_to :series, inverse_of: :data_sources
  has_many :data_points, dependent: :delete_all
  has_many :data_source_downloads, dependent: :delete_all
  has_many :downloads, -> {distinct}, through: :data_source_downloads
  has_many :data_source_actions, dependent: :delete_all

  composed_of   :last_run,
                :class_name => 'Time',
                :mapping => %w(last_run_in_seconds to_r),
                :constructor => Proc.new { |t| Time.zone.at(t || 0) },
                :converter => Proc.new { |t| t.is_a?(Time) ? t : Time.zone.at(t/1000.0) }

  before_update :set_dependencies_without_save

  ## Following regex matches Ruby hash literals using either old- or new-style syntax (or both mixed), keys that are
  ## composed only of alphanumerics and underscore, and values that are either single- or double-quoted strings, or
  ## unquoted integers. Unquoted floating point numbers are not recognized as values. String values may contain any
  ## characters except the same kind of quote as the delimiter; escaping of embedded quotes is not recognized.
  ## Ruby's peculiar quoting mechanisms like %q and %Q are not recognized. Anything other than what is described
  ## here will break it.
  OPTIONS_MATCHER = %r/({(\s*(:\w+\s*=>|\w+:)\s*((['"]).*?\5|\d+)\s*,?)+\s*})/


    def DataSource.type_buckets
      type_buckets = {:arithmetic => 0, :aggregation => 0, :share => 0, :seasonal_factors => 0, :mean_corrected_load => 0, :interpolation => 0, :sa_load => 0, :other_mathemetical => 0, :load => 0}
      all_evals = DataSource.all_evals
      all_evals.each do |eval|
        next if eval.nil?
        type_buckets[:arithmetic] += 1 unless eval.index(' + ').nil? and eval.index(' - ').nil? and eval.index(' / ').nil? and eval.index(' * ').nil? and eval.index(' ** ').nil? and eval.index('zero_add').nil? 
        type_buckets[:aggregation] += 1 unless eval.index('aggregate').nil?
        type_buckets[:share] += 1 unless eval.index('share').nil?
        type_buckets[:seasonal_factors] += 1 unless eval.index('seasonal_adjustment').nil?
        type_buckets[:mean_corrected_load] += 1 unless eval.index('load_mean_corrected_sa_from').nil?
        type_buckets[:sa_load] += 1 unless eval.index('load_sa_from').nil?
        type_buckets[:interpolation] += 1 unless eval.index('interpolate').nil?
        type_buckets[:other_mathemetical] += 1 unless eval.index('rebase').nil? and eval.index('annual').nil?
        type_buckets[:load] += 1 unless eval.index('load_from').nil?
      end
      type_buckets
    end

    def DataSource.get_all_uhero
      DataSource.where(universe: 'UHERO')
    end

    #technically, this will not check for duplicate series
    #that are loading two seasonally adjusted source spreadsheets
    #but this should not happen, so not worried
    def DataSource.all_evals
      DataSource.get_all_uhero.pluck(:eval)
    end

    def DataSource.handle_hash
      handle_hash = {}
      DataSource.where("eval LIKE '%load_from_download%'").select([:eval, :series_id]).all.each do |ds|
        handle = ds.eval.split('load_from_download')[1].split("\"")[1]
        handle_hash[ds.series_id] = handle
      end
      handle_hash
    end

    def DataSource.all_load_from_file_series_names
      series_names = []
      DataSource.where("eval LIKE '%load_from %'").all.each do |ds|
        series_names.push ds.series.name
      end
      series_names.uniq
    end
    
    #const is not there yet
    def DataSource.all_history_and_manual_series_names
      series_names = []
      %w(sic permits agriculture Kauai HBR prud census trms vexp hud hiwi_upd const_hist tax_hist tke).each do |type|
        DataSource.where("eval LIKE '%load_from %#{type}%'").each do |ds|
          series_names.push ds.series.name
        end
      end
      %w(visusns vrlsns tke tkb vrdc gffot yl_o yl_tu yl_trade).each do |type|
        DataSource.where("eval LIKE '%#{type}%load_from %'").each do |ds|
          series_names.push ds.series.name
        end
      end

      series_names.push 'PC_ANNUAL@HON.M'
      series_names.push 'PCTRGSMD@HON.M'
      series_names.push 'NTTOURNS@HI.M'
      series_names.uniq
    end
    
    def DataSource.pattern_only_series_names
      DataSource.all_pattern_series_names - DataSource.all_load_from_file_series_names
    end
    def DataSource.load_only_series_names
      DataSource.all_load_from_file_series_names - DataSource.all_pattern_series_names
    end
    def DataSource.pattern_and_load_series_names
      DataSource.all_pattern_series_names & DataSource.all_load_from_file_series_names
    end
    def DataSource.load_and_pattern_series_names
      DataSource.pattern_and_load_series_names
    end
    
    def DataSource.series_sources
      sa_series_sources = [] 
      DataSource.all_evals.each {|eval| sa_series_sources.push(eval) unless eval.index('load_sa_from').nil?}
      sa_series_sources
    end


    def DataSource.set_dependencies
      Rails.logger.info { 'DataSource set_dependencies: start' }
      DataSource.get_all_uhero.find_each(batch_size: 50) do |ds|
        Rails.logger.debug { "DataSource set_dependencies: for #{ds.description}" }
        ds.set_dependencies
      end
      Rails.logger.info { 'DataSource set_dependencies: done' }
      return 0
    end

    def current_data_points
      self.data_points.where(:current => true).order(:date).all
    end
    
    def create_from_form
      Series.eval Series.find_by(id: self.series_id).name, self.eval, self.priority
      true
    end

    ## Other definitions for my series, not including me
    def colleagues
      series.enabled_data_sources.reject {|d| d.id == self.id }
    end

    def setup
      self.set_dependencies
      self.set_color
    end

    def reload_source(clear_first = false)
      return false if disabled?
      Rails.logger.info { "Begin reload of definition #{id} for series <#{self.series}> [#{description}]" }
      t = Time.now
      update_props = { last_run: t, last_run_at: t, last_error: nil, last_error_at: nil, runtime: nil }

      eval_stmt = self['eval'].dup
      begin
        if eval_stmt =~ OPTIONS_MATCHER  ## extract the options hash
          options = Kernel::eval $1    ## reconstitute
          hash = Digest::MD5.new << eval_stmt
          eval_stmt.sub!(OPTIONS_MATCHER, options.merge(data_source: id,
                                                      eval_hash: hash.to_s,
                                                      dont_skip: clear_first.to_s).to_s) ## injection hack :=P -dji
                                                ## if more keys are added to this merge, add them to Series.display_options()
        end
        s = Kernel::eval eval_stmt
        if clear_first
          delete_data_points
        end
        s = self.send(presave_hook, s) if presave_hook

        base_year = base_year_from_eval_string(eval_stmt, self.dependencies)
        if !base_year.nil? && base_year != self.series.base_year
          self.series.update!(:base_year => base_year.to_i)
        end
        self.series.update_data(s.data, self)
        update_props.merge!(description: s.name, runtime: Time.now - t)
      rescue => e
        Rails.logger.error { "Reload definition #{id} for series <#{self.series}> [#{description}]: Error: #{e.message}" }
        update_props.merge!(last_error: e.message[0..253], last_error_at: t)
        return false
      ensure
        self.reload if presave_hook  ## it sucks to have to do this, but presave_hook might change something, that will end up saved below
        self.update!(update_props)
      end
      Rails.logger.info { "Completed reload of definition #{id} for series <#{self.series}> [#{description}]" }
      true
    end

    def base_year_from_eval_string(eval_string, dependencies)
      if eval_string =~ /rebase/
        base_year = eval_string[/rebase\("(\d*)/, 1]
        unless base_year.nil?
          return base_year.to_i
        end
        base_series = (eval_string[/"([^"]*)"\.ts\.rebase/, 1][0..-2] + 'A').ts
        if base_series.nil?
          return nil
        end
        return base_series.data.keys.sort[-1].year
      end
      dependencies.each do |s|
        ds = s.ts
        if !ds.nil? && !ds.base_year.nil? && ds.base_year > 0
          return ds.base_year
        end
      end
      nil
    end

    def reset(clear_cache = true)
      self.data_source_downloads.each do |dsd|
        dsd.update_attributes(
            last_file_vers_used: DateTime.parse('1970-01-01'), ## the column default value
            last_eval_options_used: nil)
      end
      if clear_cache
        Rails.cache.clear          ## clear file cache on local (prod) Rails
        ResetWorker.perform_async  ## clear file cache on the worker Rails
        Rails.logger.warn { 'Rails file cache CLEARED' }
      end
    end

    def mark_as_pseudo_history
      data_points.each {|dp| dp.update_attributes(:pseudo_history => true) }
    end
    
    def mark_as_pseudo_history_before(date)
      data_points.where("date < '#{date}'" ).each {|dp| dp.update_attributes(:pseudo_history => true) }
    end

    def unmark_as_pseudo_history
      data_points.each {|dp| dp.update_attributes(:pseudo_history => false) }
    end
    
    def unmark_as_pseudo_history_before(date)
      data_points.where("date_string < '#{date}'" ).each {|dp| dp.update_attributes(:pseudo_history => false) }
    end

    ## This method appears to be vestigial - confirm and delete later
    def delete_all_other_sources
      s = self.series
      s.data_sources_by_last_run.each {|ds| ds.delete unless ds.id == self.id}
    end

    ## This method appears to be vestigial - confirm and delete later
    def DataSource.delete_related_sources_except(ids)
      ds_main = DataSource.find_by(id: ids[0])
      s = ds_main.series
      s.data_sources_by_last_run.each {|ds| ds.delete if ids.index(ds.id).nil?}
    end
        
    def current?
      self.series.current_data_points.each { |dp| return true if dp.data_source_id == self.id }
      return false
    rescue
      return false
    end
        
    def delete_data_points
      data_points.each {|dp| dp.delete }
      Rails.logger.info { "Deleted all data points for definition #{id}" }
    end

    ## this method not really needed, eh?
    def delete
      delete_data_points
      super
    end

    def disable
      self.transaction do
        self.update_attributes!(disabled: true)
        delete_data_points
      end
    end

    def toggle_reload_nightly
      self.update_attributes!(reload_nightly: !self.reload_nightly)
    end

    def set_color
      color_order = %w(FFCC99 CCFFFF 99CCFF CC99FF FFFF99 CCFFCC FF99CC CCCCFF 9999FF 99FFCC)
      #puts '#{self.id}: #{self.series_id}"
      other_sources = self.series.data_sources_by_last_run
      other_sources.each do |source|
        color_order.delete source.color unless source.color.nil?
      end
      self.color = color_order[0]
      self.save
    end

    #### Do we really need this method? Test to find out
    def series
      Series.find_by id: self.series_id
    end

    def get_eval_statement
      "\"#{self.series.name}\".ts_eval= %Q|#{self.eval}|"
    end

  def set_dependencies_without_save
    self.set_dependencies(true)
  end

  def set_dependencies(dont_save = false)
    self.dependencies = []
    unless description.blank?
      description.split(' ').each do |word|
        if DataSource.valid_series_name(word)
          self.dependencies.push(word)
        end
      end
      self.dependencies.uniq!
    end
    self.save unless dont_save
  end

  def DataSource.load_error_summary
    ## Extra session acrobatics used to prevent error based on sql_mode=ONLY_FULL_GROUP_BY
    DataSource.connection.execute(%q{set SESSION sql_mode = ''})        ## clear it out to prepare for query
    results = DataSource.connection.execute(<<~MYSQL)
      select last_error, series_id, count(*) from data_sources
      where universe = 'UHERO'
      and last_error is not null
      and not disabled
      group by last_error
      order by 3 desc, 1
    MYSQL
    DataSource.connection.execute('set @@SESSION.sql_mode = DEFAULT')    ## restore defaults
    results.to_a
  end

  # The mass_update_eval_options method is not called from within the codebase, because it is mainly intended
  # to be called from the Rails command line, by a developer doing mass updates to the database.
  #
  # The +change_set+ parameter is a collection or array of DataSource objects to be changed.
  #
  # The +replace_options+ parameter is a hash representing the changes that should be made to the
  #   options hash in each DataSource (DS) in the change_set. The members of the replace_options hash
  #   may be one of the following three kinds. A key in +replace_options+ which:
  #     * Also EXISTS in the current options hash of the DS, will cause that entry in the DS hash to be replaced.
  #     * DOES NOT yet exist in the current options hash of the DS, will cause that entry to be added to the DS hash.
  #     * Has a value of nil, will cause an existing entry(key) to be deleted from the DS hash.
  #
  #   Values may be of the following two kinds:
  #     * A value which is a normal Ruby data type will be replaced/added into the DS hash in stringified form.
  #     * A value that is an anonymous function (Proc.new or lambda) allows the value actually replaced/added
  #       into the new hash to be computed on the fly. This function MUST be written to take a single parameter,
  #       which is the options hash in its current state of rewriting. "Current state" means that the order that
  #       keys are given in the replace_options may be relevant to how anon function values are computed. An anon
  #       function may make use of a value that is computed _prior_ to it in the processing of the replace_options.
  #       See the examples for how this works.
  #
  #   The +commit+ parameter just tells whether to commit the changes to the database, default is false because you
  #   should do dry run(s) first to see what the output will be before committing.
  #
  # Examples:
  #
  # First, let the change set be
  #
  #  cset = DataSource.where(%q{eval like '%UIC@haw%'})
  #
  # then we can:
  # Change the :start_date for all rows to be July 4, 2011:
  #
  #   DataSource.mass_update_eval_options(cset, { start_date: "2011-07-04" })
  #
  # Remove the :frequency option from all rows:
  #
  #   DataSource.mass_update_eval_options(cset, { frequency: nil })
  #
  # On the XLS worksheet "iwcweekly", a new column was added at the far left, causing all other columns to shift
  # to the right by one:
  #
  #   DataSource.mass_update_eval_options(cset, { col: lambda {|op| op[:sheet] == 'iwcweekly' ? op[:col].to_i + 1 : op[:col] } })
  #
  # Change :start_date to be "2015-01-01" plus the number of months indicated by :col, and then (sequentially) set :end_date to
  # be exactly 10 years and 1 day after the new start_date:
  #
  #   DataSource.mass_update_eval_options(cset,
  #           { start_date: lambda {|op| (Date.new(2015, 1, 1) + op[:col].to_i.months).strftime("%F") },
  #              end_date:  lambda {|op| (Date.strptime(op[:start_date],'%Y-%m-%d') + 10.years + 1.day).strftime("%F") } })
  #
  # Here's one that I just used in real life: some load statements have a :row specification like "increment:39:1".
  # The first integer (39 here) in each row spec needed to be incremented by one (they're not all 39 in the change set).
  # The replace_options used is:
  #
  #    { row: lambda {|op| nr = (op[:row].split(':'))[1].to_i + 1; op[:row].sub(/:\d+:/, ":#{nr}:") } }
  #
  #
  # BE CAREFUL! Always check changes carefully by doing dry runs before committing to the database!
  #
  def DataSource.mass_update_eval_options(change_set, replace_options, commit = false)
    change_set.each do |ds|
      begin
        options = (ds.eval =~ OPTIONS_MATCHER) ? Kernel::eval($1) : nil
        unless options
          raise "Definition id=#{ds.id} eval string does not contain a valid options hash"
        end
        replace_options.each do |key, value|
          if value.nil?
            options.delete(key)
          else
            new_value = value.class == Proc ? value.call(options) : value
            options[key] = new_value.to_s
          end
        end
        opt_string = options.to_s
        if commit
          ds.update_attributes(
              eval: ds.eval.sub(OPTIONS_MATCHER, opt_string),
              description: ds.description.sub(OPTIONS_MATCHER, opt_string))
        end
        puts opt_string
      rescue
          #do something?
          raise
      end
    end
  end

end
