class NtaUpload < ActiveRecord::Base
  require 'date'
  before_destroy :delete_files_from_disk
  before_destroy :delete_data_and_data_sources

  enum status: { processing: 'processing', ok: 'ok', fail: 'fail' }

  def store_upload_files(series_file)
    now = Time.now.localtime
    return false unless series_file
    series_file_content = series_file.read
    series_file_ext = series_file.original_filename.split('.')[-1]
    self.series_filename = NtaUpload.make_filename(now, 'series', series_file_ext)
    self.set_status('series', :processing)

    self.upload_at = Time.now
    begin
      self.save or raise StandardError, 'NTA upload object save failed'
      write_file_to_disk(series_filename, series_file_content) or raise StandardError, 'NTA upload disk write failed'
      NtaCsvWorker.perform_async(id)
    rescue => e
      self.delete if e.message =~ /disk write failed/
      return false
    end
    true
  end

  def set_active(status)
    self.update! :active => status
  end

  def make_active
    NtaUpload.update_all active: false
    NtaLoadWorker.perform_async(self.id)
    self.update series_status: 'processing'
  end

  def make_active_settings
    return false unless DataPoint.update_public_data_points 'NTA'
    logger.debug { 'DONE DataPoint.update_public_data_points' }
    NtaUpload.update_all active: false
    self.update! active: true, last_error: nil, last_error_at: nil
  end

  def get_status(which)
    if which == 'cats'
      cats_status
    else
      series_status
    end
  end

  def set_status(which, status)
    if which == 'cats'
      self.update_attributes(:cats_status => status)
    else
      self.update_attributes(:series_status => status)
    end
  end

  def absolute_path(which = nil)
    if which == 'cats'
      path(cats_filename)
    elsif which == 'series'
      path(series_filename)
    else
      path
    end
  end

  def retrieve_series_file
    read_file_from_disk(series_filename)
  end

  def delete_series_file
    xlspath = absolute_path('series')
    if series_filename && File.exists?(xlspath)
      r = delete_file_from_disk xlspath
      r &&= FileUtils.rm_rf xlspath.change_file_extension('')  ## the dir containing csv files -dji
      return r
    end
    true
  end

  def full_load
    logger.debug { "NtaLoadWorker id=#{self.id} BEGIN full load #{Time.now}" }
    load_cats_csv
    logger.debug { "NtaLoadWorker id=#{self.id} DONE load cats #{Time.now}" }
    load_series_csv
    logger.debug { "NtaLoadWorker id=#{self.id} DONE load series #{Time.now}" }
    load_data_postproc
    logger.debug { "NtaLoadWorker id=#{self.id} DONE load postproc #{Time.now}" }
    make_active_settings
    logger.info { "NtaLoadWorker id=#{self.id} loaded as active #{Time.now}" }
  end

  def load_cats_csv
    logger.debug { 'starting load_cats_csv' }
    unless series_filename
      raise 'load_cats_csv: no series_filename'
    end
    csv_path = path(series_filename).change_file_extension('')
    unless Dir.exists?(csv_path) || ENV['OTHER_WORKER'] && system("rsync -rt #{ENV['OTHER_WORKER'] + ':' + csv_path} #{absolute_path}")
      raise "load_cats_csv: couldn't find csv dir #{csv_path}"
    end
    cats_path = File.join(csv_path, 'description.csv')
    unless File.exists?(cats_path)
      raise "load_cats_csv: couldn't find file #{cats_path}"
    end

    # Clean out all the things, but not the root category
    logger.debug { "NtaLoadWorker id=#{self.id} BEGIN DELETING THE WORLD #{Time.now}" }
    NtaUpload.delete_universe_nta

    root = Category.find_by(universe: 'NTA', ancestry: nil).id rescue raise('No NTA root category found')

    CSV.foreach(cats_path, {col_sep: "\t", headers: true, return_headers: false}) do |row|
      next unless row[2] =~ /indicator/i

      data_list_name = 'NTA_%s' % row[0].to_ascii.strip
      long_name = row[1].to_ascii.strip
      parent_cat_name = row[4].to_ascii.strip
      parent_cat = Category.get_or_new_nta({ name: parent_cat_name }, { ancestry: root })
      ancestry = "#{root}/#{parent_cat.id}"
      category = Category.get_or_new_nta({ meta: data_list_name }, { name: long_name, ancestry: ancestry })

      data_list_name.gsub!(/\W+/, '_')  ## From here down, slugify

      ## data_list
      data_list = DataList.create(universe: 'NTA', name: data_list_name)
      category.update data_list_id: data_list.id

      ## units
      unit_str = row[3] && row[3].to_ascii.strip
      unit = (unit_str.blank? || unit_str.downcase == 'none') ? nil : Unit.get_or_new(unit_str, 'NTA')

      ## percent
      percent = row[5] =~ /growth rate/i ? false : true

      ## source
      desc = link = nil
      ## advanced regex: ? following normal stuff means 0 or 1 of the preceding;
      ##                 ? following another quantifier means "don't be greedy"
      if row[6] =~ /^(.*?)(https?:.*)?$/
        desc = ($1 && !$1.blank?) ? $1.to_ascii.strip : nil
        link = ($2 && !$2.blank?) ? $2.to_ascii.strip : nil
      end
      source = (desc || link) ? Source.get_or_new(desc, link, 'NTA') : nil

      ## measurement
      measurement = Measurement.find_by(universe: 'NTA', prefix: data_list_name)
      if measurement.nil?
        measurement = Measurement.create(
          universe: 'NTA',
          prefix: data_list_name,
          data_portal_name: 'All Countries',
          unit_id: unit && unit.id,
          percent: percent,
          source_id: source && source.id
        )
      else
        measurement.update data_portal_name: long_name
      end
      if data_list.measurements.where(id: measurement.id).empty?
        DataListMeasurement.create(data_list_id: data_list.id, measurement_id: measurement.id, indent: 'indent0', list_order: 11)
        logger.debug "added measurement #{measurement.prefix} to data_list #{data_list.name}"
      end
    end
    ## Alphabetize the parent categories
    parents = Category.where('universe = "NTA" and ancestry is not null and meta is null')
    list_order = 0
    parents.sort {|a,b| a.name <=> b.name }.each {|cat| cat.update!(list_order: list_order); list_order = list_order + 1 }
    true
  end

  def load_series_csv
    logger.debug { 'starting load_series_csv' }
    unless series_filename
      raise 'load_series_csv: no series_filename'
    end
    csv_path = path(series_filename).change_file_extension('')
    unless Dir.exists?(csv_path) || ENV['OTHER_WORKER'] && system("rsync -rt #{ENV['OTHER_WORKER'] + ':' + csv_path} #{absolute_path}")
      raise "load_series_csv: couldn't find csv dir #{csv_path}"
    end
    series_path = File.join(csv_path, 'database.csv')
    unless File.exists?(series_path)
      raise "load_series_csv: couldn't find file #{series_path}"
    end

    # if data_sources exist => set their current flag to true
    if DataSource.where("eval LIKE 'NtaUpload.load(#{id},%)'").count > 0
      logger.debug { 'NTA data already loaded; Resetting current column values' }
      NtaUpload.connection.execute <<~SQL
        UPDATE data_points SET current = 0
        WHERE data_points.data_source_id IN (SELECT id FROM data_sources WHERE eval LIKE 'NtaUpload.load(%)');
      SQL
      logger.debug { 'Reset all to current = false' }
      NtaUpload.connection.execute <<~SQL
        UPDATE data_points SET current = 1
        WHERE data_points.data_source_id IN (SELECT id FROM data_sources WHERE eval LIKE 'NtaUpload.load(#{id},%)');
      SQL
      logger.debug { 'Reset this upload to current = true' }
      return true
    end

    logger.debug { 'start loading NTA data' }
    current_series = nil
    current_data_source = nil
    data_points = []

    indicators = Category.where('universe = "NTA" and meta is not null')
    indicators.each do |cat|
      logger.debug { "LOADING category #{cat.meta}\t\t\tat #{Time.now}" }
      measurement = cat.data_list.measurements.first rescue raise("load_series_csv: no data list for #{cat.meta}")
      raise("load_series_csv: no measurement for #{cat.meta}") unless measurement
      prefix = measurement.prefix
      indicator_name = cat.meta.sub(/^NTA_/,'')
      indicator_title = cat.name

      CSV.foreach(series_path, {col_sep: "\t", headers: true, return_headers: false}) do |row|
        row_data = {}
        ## convert row data to a hash keyed on column header. force all blank/empty to nil.
        row.to_a.each {|header, data| row_data[header.to_ascii.strip] = data.blank? ? nil : data.to_ascii.strip }

        group = row_data['group'].downcase
        next unless ['world','region','income group','country'].include? group

        geo_part = row_data['iso3166a'] || row_data['name'].titlecase
        geo_part.sub!(/\s*countries.*$/i, '')     ## Clean up for income group names
        geo_part.gsub!(/\W+/, '_')

        series_name = '%s@%s.A' % [ prefix.gsub(/\W+/, '_'), geo_part ]

        if current_series.nil? || current_series.name != series_name
            geo_id = group == 'country' ? make_country_geos(row_data) : nil
            current_series = Series.find_by(name: series_name) ||
                             Series.create(
                               universe: 'NTA',
                               name: series_name,
                               dataPortalName: indicator_title,
                               frequency: 'year',
                               geography_id: geo_id,  #### Updated for Region/Income Group series below in post proc
                               unit_id: measurement.unit_id,
                               percent: measurement.percent,
                               source_id: measurement.source_id
                           )
            eval_str = "NtaUpload.load(#{id}, #{current_series.id})"
            current_data_source = DataSource.find_by(eval: eval_str)
            if current_data_source.nil?
              current_data_source = DataSource.create(
                universe: 'NTA',
                eval: eval_str,
                description: "NTA Upload #{id} for #{series_name} (#{current_series.id})",
                series_id: current_series.id,
                last_run: Time.now,
                last_run_in_seconds: Time.now.to_i
              )
            else
              current_data_source.update last_run_in_seconds: Time.now.to_i
            end
        end
        data_points.push({series_id: current_series.id,
                          data_source_id: current_data_source.id,
                          date: row_data['year'] + '-01-01',
                          value: row_data[indicator_name]}) if row_data[indicator_name]
      end
    end
    logger.debug { 'DEBUG: starting to load data points in batches of 1000' }
    if current_series && data_points.length > 0
      data_points.in_groups_of(1000) do |dps|
        values = dps.compact
                    .uniq {|dp| '%s %s %s' % [dp[:series_id], dp[:data_source_id], dp[:date]] }
                    .map {|dp| %q|('%s', %s, %s, NOW(), STR_TO_DATE('%s','%%Y-%%m-%%d'), %s, true)| %
                               ['NTA', dp[:series_id], dp[:data_source_id], dp[:date], dp[:value]] }
                    .join(',')
        NtaUpload.connection.execute <<~SQL
          REPLACE INTO data_points (universe,series_id,data_source_id,created_at,`date`,`value`,`current`) VALUES #{values};
        SQL
      end
    end
    logger.debug { 'DEBUG: Final data source updating' }
    nta_data_sources = DataSource.where('eval LIKE "NtaUpload.load(%)"').pluck(:id)
    DataPoint.where(data_source_id: nta_data_sources).update_all(current: false)
    new_nta_data_sources = DataSource.where("eval LIKE 'NtaUpload.load(#{id},%)'").pluck(:id)
    DataPoint.where(data_source_id: new_nta_data_sources).update_all(current: true)
  end

  def make_country_geos(row_data)
    geo_region = Geography.get_or_new_nta({ handle: row_data['regn'].gsub(/\W+/, '_') },
                                          { display_name: row_data['regn'],
                                            display_name_short: row_data['regn'],
                                            geotype: 'region1'})
    Geography.get_or_new_nta({ handle: row_data['subregn'].gsub(/\W+/, '_') },
                             { display_name: row_data['subregn'],
                               display_name_short: row_data['subregn'],
                               geotype: 'region2',
                               parents: geo_region.id })
    income_grp = (row_data['incgrp'] || row_data['incgrp2015']).sub(/\s*countries.*$/i, '').titlecase
    geo_incgrp = Geography.get_or_new_nta({ handle: income_grp.gsub(/\W+/, '_') },
                                          { display_name: "#{income_grp} Countries",
                                            display_name_short: "#{income_grp} Countries",
                                            geotype: 'incgrp1' })
    geo_country = Geography.get_or_new_nta({ handle: row_data['iso3166a'].gsub(/\W+/, '_') },
                                           { display_name: row_data['name'],
                                             display_name_short: row_data['name'],
                                             geotype: 'region3',
                                             parents: [geo_region.id, geo_incgrp.id] })
    geo_country.id
  end

  def NtaUpload.load(id, series_id)
    du = NtaUpload.find(id) || raise("No NtaUpload found with id=#{id}")
    du.full_load
  end

  def NtaUpload.average(id, group)
    # this method is a noop/placeholder
    "#{id} #{group}"
  end

  def NtaUpload.delete_universe_nta
    ActiveRecord::Base.connection.execute <<~SQL
      delete from public_data_points where universe = 'NTA' ;
    SQL
    ActiveRecord::Base.connection.execute <<~SQL
      delete from data_points where universe = 'NTA' ;
    SQL
    ActiveRecord::Base.connection.execute <<~SQL
      delete ms from measurement_series ms join measurements m on m.id = ms.measurement_id where m.universe = 'NTA' ;
    SQL
    ActiveRecord::Base.connection.execute <<~SQL
      delete dm from data_list_measurements dm join data_lists d on d.id = dm.data_list_id where d.universe = 'NTA' ;
    SQL
    ActiveRecord::Base.connection.execute <<~SQL
      delete from data_sources where universe = 'NTA' ;
    SQL
    ActiveRecord::Base.connection.execute <<~SQL
      delete from series where universe = 'NTA' ;
    SQL
    ActiveRecord::Base.connection.execute <<~SQL
      delete from measurements where universe = 'NTA' ;
    SQL
    ActiveRecord::Base.connection.execute <<~SQL
      delete from units where universe = 'NTA' ;
    SQL
    ActiveRecord::Base.connection.execute <<~SQL
      delete from sources where universe = 'NTA' ;
    SQL
    ActiveRecord::Base.connection.execute <<~SQL
      delete gt from geo_trees gt join geographies g on g.id = gt.parent_id where g.universe = 'NTA' ;
    SQL
    ActiveRecord::Base.connection.execute <<~SQL
      delete from geographies where universe = 'NTA' ;
    SQL
    ActiveRecord::Base.connection.execute <<~SQL
      delete from categories where universe = 'NTA' and ancestry is not null ;
    SQL
    ActiveRecord::Base.connection.execute <<~SQL
      delete from data_lists where universe = 'NTA' ;
    SQL
  end

  def load_data_postproc
    logger.debug { "DEBUG: NtaLoadWorker starting load_cats_postproc at #{Time.now}" }
    NtaUpload.connection.execute <<~SQL
      /*** Create measurements NTA_<var>_regn ***/
      insert measurements (universe, prefix, data_portal_name, unit_id, percent, source_id, created_at, updated_at)
      select distinct 'NTA', concat(m.prefix, '_regn'), 'Region', m.unit_id, m.percent, m.source_id, now(), now()
      from measurements m
      where m.universe = 'NTA'
      and m.data_portal_name = 'All Countries'
    SQL
    NtaUpload.connection.execute <<~SQL
      /*** Create measurements NTA_<var>_regn_<region> ***/
      insert measurements (universe, prefix, data_portal_name, unit_id, percent, source_id, created_at, updated_at)
      select distinct 'NTA', concat(m.prefix, '_regn_', g.handle), g.display_name, m.unit_id, m.percent, m.source_id, now(), now()
      from measurements m
        join geographies g on m.universe = g.universe and g.geotype = 'region1'
      where m.universe = 'NTA'
      and m.data_portal_name = 'All Countries'
    SQL
    NtaUpload.connection.execute <<~SQL
      /*** Create measurements NTA_<var>_incgrp ***/
      insert measurements (universe, prefix, data_portal_name, unit_id, percent, source_id, created_at, updated_at)
      select distinct 'NTA', concat(m.prefix, '_incgrp'), 'Income Group', m.unit_id, m.percent, m.source_id, now(), now()
      from measurements m
      where m.universe = 'NTA'
      and m.data_portal_name = 'All Countries'
    SQL
    NtaUpload.connection.execute <<~SQL
      /*** Create measurements NTA_<var>_incgrp_<incgrp> ***/
      insert measurements (universe, prefix, data_portal_name, unit_id, percent, source_id, created_at, updated_at)
      select distinct 'NTA', concat(m.prefix, '_incgrp_', g.handle), g.display_name, m.unit_id, m.percent, m.source_id, now(), now()
      from measurements m
        join geographies g on m.universe = g.universe and g.geotype = 'incgrp1'
      where m.universe = 'NTA'
      and m.data_portal_name = 'All Countries'
    SQL
    NtaUpload.connection.execute <<~SQL
      /*** Update geography link for series NTA_<var>@<region>.A ***/
      update series s
        join geographies g
           on LEFT(substring_index(substring_index(s.name, '@', -1), '.', 1), 4) = LEFT(g.handle, 4)
          and g.geotype = 'region1'
      set s.geography_id = g.id
      where s.universe = 'NTA'
      and s.geography_id is null
    SQL
    NtaUpload.connection.execute <<~SQL
      /*** Update geography link for series NTA_<var>@<incgrp>.A ***/
      update series s
        join geographies g
           on substring_index(substring_index(s.name, '@', -1), '.', 1) = g.handle
          and g.geotype = 'incgrp1'
      set s.geography_id = g.id
      where s.universe = 'NTA'
      and s.geography_id is null
    SQL
    NtaUpload.connection.execute <<~SQL
      /*** Associate measurements NTA_<var> (All Countries)
                      with series NTA_<var>@<country_iso>.A            ***/
      insert measurement_series (measurement_id, series_id)
      select distinct m.id, s.id
      from series s
        join geographies g on g.id = s.geography_id
        join measurements m
           on m.universe = s.universe
          and m.prefix = substring_index(s.name, '@', 1)
          and m.data_portal_name = 'All Countries'
      where s.universe = 'NTA'
      and g.geotype = 'region3'
    SQL
    NtaUpload.connection.execute <<~SQL
      /*** Associate measurements NTA_<var>_regn_<region>
                      with series NTA_<var>@<country_iso>.A            ***/
      insert measurement_series (measurement_id, series_id)
      select distinct m.id, s.id
      from series s
        join geographies g on g.id = s.geography_id
        join geo_trees gt on s.geography_id = gt.child_id
        join geographies gr on gr.id = gt.parent_id and gr.geotype = 'region1'
        join measurements m
           on m.universe = s.universe
          and m.prefix = concat(substring_index(s.name, '@', 1), '_regn_', gr.handle)
      where s.universe = 'NTA'
      and g.geotype = 'region3'
    SQL
    NtaUpload.connection.execute <<~SQL
      /*** Associate measurements NTA_<var>_incgrp_<incgrp>
                      with series NTA_<var>@<country_iso>.A            ***/
      insert measurement_series (measurement_id, series_id)
      select distinct m.id, s.id
      from series s
        join geographies g on g.id = s.geography_id
        join geo_trees gt on s.geography_id = gt.child_id
        join geographies gi on gi.id = gt.parent_id and gi.geotype = 'incgrp1'
        join measurements m
           on m.universe = s.universe
          and m.prefix = concat(substring_index(s.name, '@', 1), '_incgrp_', gi.handle)
      where s.universe = 'NTA'
      and g.geotype = 'region3'
    SQL
    NtaUpload.connection.execute <<~SQL
      /*** Associate measurements NTA_<var>_regn with series NTA_<var>@<region>.A ***/
      insert measurement_series (measurement_id, series_id)
      select distinct m.id, s.id
      from series s
        join geographies g on g.id = s.geography_id
        join measurements m
           on m.universe = s.universe
          and m.prefix = concat(substring_index(s.name, '@', 1), '_regn')
      where s.universe = 'NTA'
      and g.geotype = 'region1'
    SQL
    NtaUpload.connection.execute <<~SQL
      /*** Associate measurements NTA_<var>_incgrp with series NTA_<var>@<incgrp>.A ***/
      insert measurement_series (measurement_id, series_id)
      select distinct m.id, s.id
      from series s
        join geographies g on g.id = s.geography_id
        join measurements m
           on m.universe = s.universe
          and m.prefix = concat(substring_index(s.name, '@', 1), '_incgrp')
      where s.universe = 'NTA'
      and g.geotype = 'incgrp1'
    SQL
    NtaUpload.connection.execute <<~SQL
      /*** Associate all measurements NTA_<var>_{regn,incgrp} with their data lists at indent 0 ***/
      insert data_list_measurements (data_list_id, measurement_id, indent, list_order)
      select distinct dl.id, m.id, 'indent0',
          case m.data_portal_name
            when 'Region' then 0
            when 'Income Group' then 6
            /* All Countries is assigned list_order 11 above in Ruby code. Change there if necessary */
            else 12
          end
      from data_lists dl
        join measurements m
           on (m.prefix like '%\_regn' or m.prefix like '%\_incgrp')
          and dl.name = replace(replace(m.prefix, '_regn', ''), '_incgrp', '') /* replace either of two strings, whichever appears */
          and dl.universe = m.universe
      where dl.universe = 'NTA'
    SQL
    NtaUpload.connection.execute <<~SQL
      /*** Associate all measurements NTA_<var>_{regn,incgrp}_{subcategory} with their data lists at indent 1 ***/
      insert data_list_measurements (data_list_id, measurement_id, indent, list_order)
      select distinct dl.id, m.id, 'indent1',
          case m.data_portal_name
              when 'AfricanRegion' then 1
              when 'AmericanRegion' then 2
              when 'AsianRegion' then 3
              when 'EuropeanRegion' then 4
              when 'OceanicRegion' then 5
              when 'Low Income' then 7
              when 'Lower Middle Income' then 8
              when 'Upper Middle Income' then 9
              when 'High Income' then 10
            else 12
          end
      from data_lists dl
        join measurements m
           on (m.prefix like '%\_regn\_%' or m.prefix like '%\_incgrp\_%')
          and dl.name = substring_index(substring_index(m.prefix, '_regn_', 1), '_incgrp_', 1)
          and dl.universe = m.universe
      where dl.universe = 'NTA'
    SQL
  end

private
  def path(name = nil)
    parts = [ENV['DATA_PATH'], 'nta_files']
    parts.push(name) unless name.blank?
    File.join(parts)
  end

  def NtaUpload.make_filename(time, type, ext)
    ## a VERY rough heuristic for whether we have a correct file extention
    ext = ext.length > 4 ? '' : '.' + ext
    time.strftime('%Y-%m-%d-%H:%M:%S') + '_' + type + ext
  end

  def write_file_to_disk(name, content)
    begin
      File.open(path(name), 'wb') { |f| f.write(content) }
    rescue StandardError => e
      Rails.logger.error e.message
      return false
    end
    true
  end

  def read_file_from_disk(name)
    begin
      content = File.open(path(name), 'r') { |f| f.read }
    rescue StandardError => e
      Rails.logger.error e.message
      return false
    end
    content
  end

  def delete_file_from_disk(abspath)
    begin
      File.delete(abspath)
    rescue StandardError => e
      Rails.logger.error e.message
      return false
    end
    true
  end

  def delete_files_from_disk
    delete_series_file
  end

  def delete_data_and_data_sources
    NtaUpload.connection.execute <<~SQL
      DELETE FROM data_points
      WHERE data_source_id IN (SELECT id FROM data_sources WHERE eval LIKE 'NtaUpload.load(#{self.id},%)');
    SQL
    DataSource.where("eval LIKE 'NtaUpload.load(#{self.id},%)'").delete_all
  end

end
