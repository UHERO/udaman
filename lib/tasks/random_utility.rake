## JIRA: UA-989
task :batch_update_meta_for_aggregated => :environment do
  agg_series = Series.get_all_uhero.joins(:data_sources).where(%q{eval like '%aggregate%' and scratch <> 1111}).uniq
  eval_match = %r/^(["'])((\S+?)@(\w+?)\.([ASQMWD]))\1\.ts\.aggregate\(:\w+,:\w+\)$/i  ## series name regex from Series.parse_name()
  marked_series = []
  cmds = {}

  agg_series.each do |s|
    name_parts = s.parse_name
    best = nil
    best_freq = -1
    s.data_sources.each do |ds|
      next unless ds.eval.gsub(/\s/,'') =~ eval_match ## match with all whitespace removed
      name = $2
      prefix = $3
      frequency = $5
      next unless prefix.upcase == name_parts[:prefix].upcase
      if frequency.freqn < name_parts[:freq].freqn
        raise "strange aggregation, lower to higher, data source id=#{ds.id}"
      end
      if best.nil? || frequency.freqn > best_freq
        best = name
        best_freq = frequency.freqn
      end
    end
    next unless best
    parent = best.ts
    unless parent
      raise "no series found with name=#{best}"
    end
    all_defined = s.unit_id && s.source_id && s.source_detail_id && s.source_link
    print "Series #{s.name}(#{s.id}): "
    # if derived series already fully matches parent, skip
    if all_defined &&
        s.unit_id == parent.unit_id &&
        s.source_id == parent.source_id &&
        s.source_detail_id == parent.source_detail_id &&
        s.source_link == parent.source_link
      puts '>>>> already match'
      next
    end
    # if derived series has none of these fields set, update them
    parent_any_defined = parent.unit_id || parent.source_id || parent.source_detail_id || parent.source_link
    unless parent_any_defined
      puts ">>>> parent #{parent.name}(#{parent.id}) got nuthin - skipping"
      next
    end
    # if derived series has none of these fields set, update them
    unless s.unit_id || s.source_id || s.source_detail_id || s.source_link
      s.update!(
          unit_id: parent.unit_id,
          source_id: parent.source_id,
          source_detail_id: parent.source_detail_id,
          source_link: parent.source_link
      )
      puts ">>>> none set, updated from #{parent.name}(#{parent.id})"
      next
    end
    puts "hand edit..."
    parent_unit = (parent.unit && parent.unit.long_label) || '(empty)'
    parent_source = (parent.source && parent.source.description) || '(empty)'
    parent_detail = (parent.source_detail && parent.source_detail.description) || '(empty)'
    parent_link = parent.source_link.blank? ? '(empty)' : parent.source_link
    loop do
      s_unit = (s.unit && s.unit.long_label) || '(empty)'
      s_source = (s.source && s.source.description) || '(empty)'
      s_detail = (s.source_detail && s.source_detail.description) || '(empty)'
      s_link = s.source_link.blank? ? '(empty)' : s.source_link
      format = sprintf('%%-22s: u=%%-%ds    s=%%-%ds    d=%%-%ds    l=%%-%ds',
                       [s_unit.length, parent_unit.length].max,
                       [s_source.length, parent_source.length].max,
                       [s_detail.length, parent_detail.length].max,
                       [s_link.length, parent_link.length].max
               )
      puts sprintf(format, parent.name, parent_unit, parent_source, parent_detail, parent_link)
      puts sprintf(format, s.name, s_unit, s_source, s_detail, s_link)
      print '> '
      cmds = STDIN.gets.chomp.split(//).map{|x| [x, true] }.to_h
      s.update!(scratch: 1111) if cmds['n']
      break if cmds['n'] || cmds['Q']
      if cmds['m']
        marked_series.push(s)
        puts "####### Series #{s.name} marked"
        next
      end
      if cmds['U']
        res_id = choose_resource(Unit, 'to_s')
        s.update!(unit_id: res_id) if res_id
        next
      end
      if cmds['S']
        res_id = choose_resource(Source, 'description')
        s.update!(source_id: res_id) if res_id
        next
      end
      if cmds['D']
        res_id = choose_resource(SourceDetail, 'description')
        s.update!(source_detail_id: res_id) if res_id
        next
      end
      updates = {}
      updates.merge!(unit_id: parent.unit_id)                   if cmds['u'] || cmds['A']
      updates.merge!(source_id: parent.source_id)               if cmds['s'] || cmds['A']
      updates.merge!(source_detail_id: parent.source_detail_id) if cmds['d'] || cmds['A']
      updates.merge!(source_link: parent.source_link)           if cmds['l'] || cmds['A']
      s.update!(updates) unless updates.empty?
      s.reload
    end
    break if cmds['Q']
  end
  puts "Marked series:"
  marked_series.sort.uniq.each {|s| puts "#{s.name} - https://udaman.uhero.hawaii.edu/series/#{s.id}" }
end

def choose_resource(klass, method)
  all_rows = klass.where(universe: 'UHERO')
  i = 1
  id_map = {}
  all_rows.each do |res|
    label = res.send(method)
    puts sprintf('%02d. %s', i, label)
    id = res.read_attribute(:id)
    id_map[i] = id
    i = i + 1
  end
  print 'choice> '
  choice = STDIN.gets.chomp.to_i
  id_map[choice]  ## returns nil for index 0
end

## JIRA: UA-993
task :create_coh_cpi_measurements => :environment do
  meas = Measurement.where(prefix: %w{CPI INFCORE INF_SH PCFB PCHS PCHSSH PCHSSHRT PCHSSHOW PCHSFU PCHSFUGSE PCHSHF
                                      PCTR PCTRMF PCMD PCRE PCED PCOT PC_FDEN PC_EN PC_MD PC_SH PCSV_MD PCSV_RN})
  meas.each do |m|
    print ">>>>> Starting measurement #{m.prefix}"
    new = m.dup
    new.update(prefix: new.prefix + '_COH')
    if new.prefix =~ /^PC/
      new.update(data_portal_name: new.data_portal_name.sub('CPI','Honolulu CPI'))
    end
    new.save!
    puts "...... #{new.prefix} SAVED"
    m.series.each do |s|
      if s.geography.handle == 'HON'
        new_name = s.name.sub('@HON','@HAW')
        s = Series.get(new_name) || s.dup_series_for_geo('HAW')
      end
      new.series << s
    end
  end
end

## JIRA UA-994
task :ua_994 => :environment do
  all_s = Series.joins(:geography).where(
      %q{(name like 'EMPL@%' or name like 'EMPLNS@%' or name like 'LF@%' or name like 'LFNS@%' or name like 'UR@%' or name like 'URNS@%')
          and geographies.handle in ('MOL','MAUI','LAN')}
  )
  all_s.sort_by {|s| s.name }.each do |s|
    print "Doing #{s.name}..."
    kau_s = s.find_sibling_for_geo('KAU')
    unless kau_s
      puts ">>>>>> No KAU sibling series found for #{s.name}"
      next
    end
    s.update_attributes!(
         dataPortalName: kau_s.dataPortalName,
         unit_id: kau_s.unit_id,
         source_id: kau_s.source_id,
         source_detail_id: kau_s.source_detail_id,
         source_link: 'https://www.hiwi.org/'
    )
    puts "done."
  end
end

## JIRA UA-1139
task :ua_1139 => :environment do
  coh_haw = Geography.find_by(universe: 'COH', handle: 'HAW').id rescue raise('No HAW geography in COH')
  coh_hi = Geography.find_by(universe: 'COH', handle: 'HI').id rescue raise('No HI geography in COH')

  Measurement.where(universe: 'UHERO').each do |m|
    dls = m.data_lists.reject{|dl| dl.universe == 'UHERO' }
    next if dls.empty?
    coh_m = m.dup
    coh_m.assign_attributes(universe: 'COH', prefix: 'COH_' + m.prefix)
    coh_m.save!
    puts ">>> Created new COH meas #{coh_m.prefix}"
    dls.each do |list|
      if list.universe != 'COH'
        Rails.logger.warn { "---------------------------- DL UNIVERSE OTHER THAN COH => id=#{list.id}, u=#{list.universe} found!" }
      end
      DataList.transaction do
        list.measurements.delete(m)
        list.measurements << coh_m
      end
      puts ">>> Replaced meas #{m.prefix} with #{coh_m.prefix} in DL #{list.name}"
    end
    siriz = m.series
    siriz.each do |s|
      if s.universe == 'COH'
        Series.transaction do
          m.series.delete(s)
          coh_m.series << s
        end
        next
      end
      ## else s.universe is UHERO or UHEROCOH
      s_geo = s.geography.handle.upcase
      unless s_geo == 'HAW' || s_geo == 'HI'
        puts ">>> non-COH geography: #{s.name}"
        s.update({ universe: 'UHERO' }) if s.universe == 'UHEROCOH'
        next
      end
      ## s.geography is HAW or HI
      coh_s = s.dup
      coh_s.assign_attributes(universe: 'COH', name: 'COH_' + s.name, geography_id: s_geo == 'HI' ? coh_hi : coh_haw)
      Series.transaction do
        coh_s.save!
        coh_m.series << coh_s
        puts ">>> New COH series #{coh_s.name} for COH meas #{coh_m.prefix}"
        s.update({ universe: 'UHERO' }) if s.universe == 'UHEROCOH'
      end
    end
  end

  ## At this point, all the series that COH should have in their portal have already been handled in the above loop,
  ## and if there are any leftover series still under universe: 'UHEROCOH', it should be safe to simply
  ## reassign these to plain ol' UHERO.
  Series.where(universe: 'UHEROCOH').each do |s|
    puts ">>> Resetting #{s.name} from UHEROCOH to UHERO"
    s.update!({ universe: 'UHERO' })
  end
end

## JIRA UA-1152
task :ua_1152 => :environment do
  coh_haw = Geography.find_by(universe: 'COH', handle: 'HAW').id rescue raise('No HAW geography in COH')
  coh_hi = Geography.find_by(universe: 'COH', handle: 'HI').id rescue raise('No HI geography in COH')

  Measurement.where(universe: 'DBEDTCOH').each do |m|
    m.update(universe: 'COH', prefix: m.prefix.sub('DBEDT','COH'))
    siriz = m.series
    siriz.each do |s|
      s_geo = s.geography.handle.upcase
      self.transaction do
        s.update!(universe: 'DBEDT')
        m.series.delete(s)
        if s.geography.handle == 'HAW' || s.geography.handle == 'HI'
          coh_s = s.dup
          coh_s.assign_attributes(universe: 'COH', name: s.name.sub('DBEDT','COHDB'),
                                  primary_series_id: s.id, geography_id: s_geo == 'HI' ? coh_hi : coh_haw)
          coh_s.save!
          m.series << coh_s
        end
      end
    end
  end
end

## JIRA UA-1160
task :ua_1160 => :environment do
  old = %w[CA4    CA5N    CA6N    RPI1  RPI2  RPP1  RPP2  IRPD1  IRPD2  SA4    SA5N    SA6N    SQ4    SQ5    SQ5N    SQ6N]
  new = %w[CAINC4 CAINC5N CAINC6N SARPI MARPI SARPP MARPP SAIRPD MAIRPD SAINC4 SAINC5N SAINC6N SQINC4 SQINC5 SQINC5N SQINC6N]

  sids = DataSource.get_all_uhero.where(%q{eval like '%load\_from\_bea%'}).map {|ds| ds.series.id }.uniq
  sids.each do |sid|
    siriz = Series.find(sid)
    bea_defs = siriz.data_sources.select {|d| d.eval =~ /load_from_bea.*Regional/ }
    next if bea_defs.count < 2

    exists = {}
    ## first pass to load up what exists here
    bea_defs.each do |d|
      next unless d.eval =~ /load_from_bea\s*\((.+?)\)/   ## extract load_from_bea parameters as a string
      (freq, dataset, opts) = Kernel::eval ('[%s]' % $1)  ## reconstitute into an array - Ruby rox
      slug = [freq, dataset, opts[:TableName]].join('|')
      exists[slug] = d
      puts "FOUND #{d.eval}"
    end
    ## second pass to check and delete, and make changes
    bea_defs.each do |d|
      next unless d.eval =~ /load_from_bea\s*\((.+?)\)/
      (freq, dataset, opts) = Kernel::eval ('[%s]' % $1)
      name_index = new.index(opts[:TableName])
      next unless dataset == 'Regional' && name_index  ## only look at these

      old_slug = [freq, 'RegionalIncome', old[name_index]].join('|')
      old_def = exists[old_slug]
      if old_def
        puts "DESTROY #{old_slug}"
        old_def.destroy
      end

      if opts[:TableName] == 'SAINC4' || opts[:TableName] == 'SQINC4'
        unless d.eval =~ /\*\s*1000\s*$/
          puts "ADD * 1000 to #{d.eval}"
          d.update!(eval: d.eval + ' * 1000')
        end
      end
    end
    puts "---- #{siriz} -----------------" unless exists.empty?
  end
end

## JIRA UA-1165
task :ua_1165 => :environment do
  old = %w[CA4    CA5N    CA6N    RPI1  RPI2  RPP1  RPP2  IRPD1  IRPD2  SA4    SA5N    SA6N    SQ4    SQ5    SQ5N    SQ6N]
  new = %w[CAINC4 CAINC5N CAINC6N SARPI MARPI SARPP MARPP SAIRPD MAIRPD SAINC4 SAINC5N SAINC6N SQINC4 SQINC5 SQINC5N SQINC6N]

  ds = DataSource.get_all_uhero.where(%q{eval like "%load\_from\_bea%'RegionalIncome'%"})
  ds.each do |d|
    unless d.eval =~ /load_from_bea\s*\((.+?)\)/
      raise "MATCH ERROR ON id = #{d.id}"
    end
    (_, dataset, opts) = Kernel::eval ('[%s]' % $1)  ## reconstitute into an array - Ruby rox
    unless dataset == 'RegionalIncome'
      raise "DATASET ERROR ON id = #{d.id}"
    end
    idx = old.index(opts[:TableName]) || next
    new_eval = d.eval.sub('RegionalIncome','Regional').sub(opts[:TableName], new[idx])
    puts "replacing | #{d.eval} | with | #{new_eval} |"
    d.update!(eval: new_eval)
  end
end
