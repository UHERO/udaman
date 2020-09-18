=begin
    ALL OF THE CODE IN THIS FILE WAS USED FOR ONE-OFF JOBS. As such, anyone refactoring udaman code in the future does not
    need to worry about any of this - it can be left alone, because it's not part of the production codebase.
=end

## JIRA UA-1367
task :ua_1367 => :environment do
  prefixes = %w{
    BURNPOSTS HOMEBEMPL HOMEBHOURS HOMEBOPEN BNKRUPTTL BNKRUPCH7 BNKRUPCH13 BNKRUPOTHR E_NF E_PR E_GDSPR ECT EMN
    E_SVCPR EWT ERT E_TU EIF EFI ERE EPS EAD EMA EED EHC EAE EAF EAFAC EAFFD EOS EGV EGVFD EGVST EGVLC EAG YS_RB
    YS YSAG YSMI YSUT YSCT YSMN YSWT YSRT YSTW YSIF YSFI YSRE YSPS YSMA YSAD YSED YSHC YSAE YSAF YSAFAC YSAFFD
    YSOS YSGV YSGVFD YSGVML UIC UICINI WHCT WHMN WHWT WHRT WH_TTU WHIF WH_FIN WHAF WHAFAC WHAFFD
  }
  prefixes.each do |p|
    puts ">>> Doing #{p}"
    m = Measurement.find_by(universe: 'UHERO', prefix: p) || raise("UHERO measurement #{p} not found")
    begin
      m.duplicate('CCOM', nil, deep_copy: true)
    rescue => e
      puts "ERROR for #{p} ==================== #{e.message}"
      next
    end
  end
end

## JIRA UA-1350
task :ua_1350 => :environment do
  all = Series.search_box('^E ~_B$ -NS .Q') + Series.search_box('^E ~_B$ -NS .A')   ### Qs need to come first, then As
  all.each do |qa|
    puts "**** 1 Doing #{qa}"
    q_nonb_name = qa.build_name(prefix: qa.parse_name[:prefix].sub(/_B$/,''))
    m_nonb_name = qa.build_name(prefix: qa.parse_name[:prefix].sub(/_B$/,''), freq: 'M')
    q_nonb = q_nonb_name.ts
    m_name = qa.build_name(freq: 'M')
    if qa.frequency == 'quarter'   ## create a new .M series only based on .Q series metadata
      m_series = qa.duplicate(m_name,
                   source_id: 3,  ## UHERO Calculation
                   dataPortalName: q_nonb && q_nonb.dataPortalName,
                   description: q_nonb && (q_nonb.description || q_nonb.dataPortalName) + ', benchmarked',
                   seasonal_adjustment: 'seasonally_adjusted',
                   seasonally_adjusted: true
      )
      load_stmt = %Q|"#{m_nonb_name}".tsn.load_from("/Users/uhero/Documents/data/rparsed/opt_bench_m.csv")|
      deps = [m_nonb_name]
      if qa.geography.handle == 'NBI'
        deps = [ m_series.build_name(geo: 'HI'),
                 m_series.build_name(geo: 'HON') ]
        load_stmt = %q|"%s".ts - "%s".ts| % deps
      elsif qa.parse_name[:prefix] == 'EGV_B'
        deps = [ m_series.build_name(prefix: 'EGVFD_B'),
                 m_series.build_name(prefix: 'E_GVSL_B') ]
        load_stmt = %q|"%s".ts + "%s".ts| % deps
      elsif qa.parse_name[:prefix] == 'E_SV_B'
        deps = [
            m_series.build_name(prefix: 'E_NF_B'),
            m_series.build_name(prefix: 'ECT_B'),
            m_series.build_name(prefix: 'EMN_B'),
            m_series.build_name(prefix: 'E_TU_B'),
            m_series.build_name(prefix: 'E_TRADE_B'),
            m_series.build_name(prefix: 'E_FIR_B'),
            m_series.build_name(prefix: 'EGV_B')
        ]
        load_stmt = %q|"%s".ts - "%s".ts - "%s".ts - "%s".ts - "%s".ts - "%s".ts - "%s".ts| % deps
      end
      loader = m_series.data_sources.create(eval: load_stmt, description: deps.join(' '))
      loader.setup
      puts "-------- Created series #{m_name}: #{load_stmt}"
    end
    ## Change all .Q/.A series to aggregate off the new .M series
    qa.enabled_data_sources.each {|ds| ds.disable }
    loader = qa.data_sources.create(eval: %Q|"#{m_name}".ts.aggregate(:#{qa.frequency}, :average)|, description: m_name)
    loader.setup
    qa.update!(source_id: 3,  ## UHERO Calculation
               dataPortalName: q_nonb && q_nonb.dataPortalName,
               description: q_nonb && (q_nonb.description || q_nonb.dataPortalName) + ', benchmarked',
               seasonal_adjustment: qa.frequency == 'year' ? 'not_applicable' : 'seasonally_adjusted',
               seasonally_adjusted: qa.frequency == 'year' ?  false           : true )
  end
end

## JIRA UA-1344
task :ua_1344 => :environment do
  qes = Series.where(%q{universe = 'UHERO' and name regexp '^QE'})
  qes.each do |s|
    puts "WORKING ON: #{s} (#{s.id})"
    disabled_one = false
    s.enabled_data_sources.select {|d| d.eval =~ /load_from/ }.each do |ds|
      puts "   DISABLING: #{ds.eval}"
      ds.disable
      disabled_one = true
    end
    if disabled_one
      s.data_sources.create(
          eval: '"%s".tsn.load_from("/Users/uhero/Documents/data/rparsed/QCEW_select.csv") / 1000' % s.name,
          priority: 100,
          color: 'CCFFFF'
      )
      puts"   CREATED NEW LOADER"
      s.reload_sources
      puts "   LOADED THE NEW ONE"
    end
    if s.data.empty?
      puts ">>>>>>>>>>>>>>>> EMPTY!! #{s.id}"
    end
  end
end

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
    s.enabled_data_sources.each do |ds|
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
    coh_m.assign_attributes(universe: 'COH')
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
      coh_s.assign_attributes(universe: 'COH', primary_series_id: s.id, geography_id: s_geo == 'HI' ? coh_hi : coh_haw)
      Series.transaction do
        coh_s.save!
        coh_m.series << coh_s
        puts ">>> New COH series created"
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
    siriz = m.series.map(&:id)  ## had trouble gathering/iterating over series objects, so use ids to be "safer"
    puts "======================= PROC measurement #{m.prefix}, count #{siriz.count}"
    siriz.each do |sid|
      s = Series.find sid
      puts ">>>>>>>>>>>>>> PROC series #{s.name} (#{sid})"
      s_geo = s.geography.handle.upcase
      Measurement.transaction do
        s.update!(universe: 'DBEDT')
        m.series.delete(s)
        puts ">>> Removed #{s.name} from meas #{m.prefix} and universe -> DBEDT"
        if s_geo == 'HAW' || s_geo == 'HI'
          coh_s = Series.find_by(universe: 'COH', xseries_id: s.xseries_id)
          if coh_s
            puts "-----------> FOUND EXISTING #{coh_s.name} (#{coh_s.id}) to match #{s.name}"
          else
            coh_s = s.dup
            coh_s.assign_attributes(universe: 'COH', primary_series_id: s.id, geography_id: s_geo == 'HI' ? coh_hi : coh_haw)
            coh_s.save!
          end
          m.series << coh_s
          puts ">>> New COH series #{coh_s.name} (#{coh_s.id}) for COH meas #{m.prefix}"
        else
          puts ">>> non-COH geography: #{s.name}"
        end
      end
    end
    puts ">>> Rename Measurement #{m.prefix} to COHDB and universe -> COH"
    m.update!(universe: 'COH')
  end

  ## At this point, all the series that COH should have in their portal have already been handled in the above loop,
  ## and if there are any leftover series still under universe: 'DBEDTCOH', it should be safe to simply
  ## reassign these to plain ol' DBEDT.
  Series.where(universe: 'DBEDTCOH').each do |s|
    puts ">>> Resetting #{s.name} from DBEDTCOH to DBEDT"
    s.update!(universe: 'DBEDT')
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

## JIRA UA-1179, first pass, reassigning DBEDT series with UHERO units to DBEDT units
task :ua_1179a => :environment do
  uh2db = {
      4 => 157,
      7 => 158,
      9 => 143,
      10 => 166,
      14 => 165,
      17 => 161,
      20 => [144, 164, 151],
      21 => 171,
      22 => 146,
      26 => 156,
      27 => 159,
      30 => 145,
      32 => 148,
      33 => 163,
      34 => 162,
      41 => [141, 172],
      43 => 167,
      44 => 139,
      45 => 140,
      46 => 168,
      47 => 155,
      48 => 169,
      49 => 170,
      50 => 152,
      51 => 154,
      54 => 147,
      57 => 138,
      63 => 149,
      67 => 150,
      69 => 160,
      70 => 153,
      131 => 142
  }
  db2uh = {}

  uh2db.keys.each do |k|
    v = uh2db[k]
    x = v.class == Array ? v[0] : v
    if db2uh[x]
      raise "already saw unit key #{x}"
    end
    db2uh[x] = k
  end

  i = 0
  deebs = Series.joins(:unit).where(%q{series.universe = 'DBEDT' and units.universe = 'UHERO'})
  deebs.each do |ds|
    new_unit = uh2db[ds.unit_id]
    if new_unit.class == Array
      new_unit = new_unit[0]
    end
    puts "deebs changing #{ds.unit_id} to #{new_unit}"
    ds.update(unit_id: new_unit)
    i += 1
  end
  puts "========================================================= end: changed #{i} records"
  i = 0
  coes = Series.joins(:unit).where(%q{series.universe = 'COH' and units.universe = 'UHERO'})
  coes.each do |c|
    next if c.primary_series && c.primary_series.universe != 'DBEDT'
    new_unit = c.primary_series.unit_id
    puts "coes changing #{c.unit_id} to #{new_unit}"
    uh_unit = uh2db[c.unit_id]
    if uh_unit.class == Array
      uh_unit = uh_unit[0]
    end
    if uh_unit != new_unit
      puts "-=-=-=-=-=-=-=--=-=-=-=-=-=-=-=-=-=-=-=-=--=-==-=-=-=-=-=-=-=-=>>>>> uh #{uh_unit} != db #{new_unit}"
    end
    c.update(unit_id: new_unit)
    i += 1
  end
  puts "========================================================= end: changed #{i} records"
end

=begin
    ALL OF THE CODE IN THIS FILE WAS USED FOR ONE-OFF JOBS. As such, anyone refactoring udaman code in the future does not
    need to worry about any of this - it can be left alone, because it's not part of the production codebase.
=end
