=begin
    ALL OF THE CODE IN THIS FILE WAS USED FOR ONE-OFF JOBS. As such, anyone refactoring udaman code in the future does not
    need to worry about any of this - it can be left alone, because it's history - not part of the production codebase.
=end

task :ua_1456_emergency_reload_ns_growth_rate => :environment do
  Series.search_box('#apply_ns_growth_rate_sa +9999').each do |s|
    puts "Doing #{s}"
    s.enabled_data_sources.each do |ld|
      next if ld.eval =~ /apply_ns_growth_rate_sa/
      ld.set_reload_nightly(true)
      if ld.eval =~ /county_share_for/
        ld.update!(eval: ld.eval.strip + '.trim(after: "2019-12-31")')
      else
        Rails.logger.info ">>>>!!!>>>>> #{s} has unexpected loaders"
      end
    end
  end
end

task :ua_1473_fill_blank_DPNs => :environment do
  dict = {}
  Series.get_all_uhero.each do |s|
    indicator = s.parse_name[:prefix].sub(/NS$/i,'')
    dpn = s.dataPortalName || next
    if dict[indicator] && dict[indicator] != dpn
      puts ">> DPN mismatch for indicator #{indicator}"
      next
    end
    dict[indicator] = dpn
  end
  puts "Finished building dictionary"
  Series.search_box('&nodpn +9999').each do |s|
    indicator = s.parse_name[:prefix].sub(/NS$/i,'')
    if dict[indicator]
      puts "Updating #{s.name}"
      s.update!(dataPortalName: dict[indicator])
    end
  end
end

task :ua_1473_fix_VSO_agg_methods => :environment do
  Series.search_box('^vso #aggregate #average +9999').each do |s|
    s.data_sources.each do |ld|
      next unless ld.eval =~ /aggregate.*:average/i
      puts "Updating #{s.name}"
      ld.update(eval: ld.eval.sub(':average', ':sum'))
    end
  end
end

task :ua_1473_turn_off_YC_series => :environment do
  Series.search_box('^yc +9999').each do |s|
    s.update!(restricted: true) unless s.restricted?
    s.data_sources.each do |ld|
      next unless ld.reload_nightly?
      ld.update(reload_nightly: false)
    end
  end
end

task :ua_1472_fix_backward_shifts => :environment do
  Series.search_box('#shift_backward_months').each do |s|
    s.data_sources.each do |ld|
      while ld.eval =~ /shift_backward_months\((-?\d+)\)/
        num = $1.to_i
        ld.update!(eval: ld.eval.sub(/shift_backward_months\((-?\d+)\)/,
                                      'shift_by(%s%d.months)' % [num < 0 ? '+' : '-', num.abs] ))
        ld.reload
      end
    end
  end
end

task :ua_1468 => :environment do
  Measurement.where(universe: 'UHERO').order(:prefix).each do |m|
    next if m.data_lists.empty?  ## not in UHERO DP
    dl_next = true
    m.data_lists.each do |dl|
      if Category.find_by(universe: 'UHERO', data_list_id: dl.id)
        dl_next = false
        break
      end
    end
    next if dl_next
    series = m.series.to_a
    s0 = series.pop || next
    result = ""
    print m.prefix, ": "
    series.each do |s|
      if (s0.source_link && s.source_link.nil?) || (s0.source_link.nil? && s.source_link)
        result = "mixed"
        break
      end
    end
    puts result
  end
end

task :find_bad_aggregations => :environment do
  dict = {}
  Series.search_box('#aggreg').each do |s|
    find_method_for_prefix(s, dict)
    s.other_frequencies.each {|otfreq| find_method_for_prefix(otfreq, dict) }
  end
  dict.reject! {|_, v| v.count < 2 }
  dict.each do |k, v|
    puts "#{k} => #{v}"
  end
end

def find_method_for_prefix(series, dict)
  prefix = series.parse_name[:prefix].sub(/NS$/i, '')
  series.enabled_data_sources('aggreg').map(&:eval).each do |ldeval|
    method = (ldeval =~ /aggregate\(:\w+, *:(\w+)/) ? $1 : nil
    unless method
      Rails.logger.warn { "find_method_for_prefix: #{series}: unexpected aggregation calling convention #{ldeval}" }
      next
    end
    dict[prefix] ||= []
    dict[prefix] |= [method.downcase]
  end
end

task :vexp_loader_job => :environment do
  ss = Series.search_box('vexp &sa .m')
  ss.each do |s|
    next if s.name == 'VEXP@HI.M'
    puts "Doing #{s}"
    s.enabled_data_sources.each {|ld| ld.disable! }
    ld = DataSource.create(priority: 100, eval: %q{"%s".tsn.load_from "rawdata/sadata/tour_vexp.csv"} % s.ns_series_name)
    s.data_sources << ld
    ld.setup
    s.reload_sources
  end
  puts "done"
end

task :ua_1099 => :environment do
  ss = Series.search_box('^v .m')
  ss.each do |s|
    puts "-------------------- #{s} ------------------------"
    t = s.moving_average
    t = s.moving_average_annavg_padded
    t = s.forward_looking_moving_average
    t = s.backward_looking_moving_average
  end
end

## JIRA UA-1428
task :ua_1428 => :environment do
  ss = Series.get_all_uhero.joins(:data_sources).distinct.where(%q{data_sources.eval regexp 'ts.aggregate'})
  ss.each do |s|
    dss = s.enabled_data_sources.reject {|ds| ds.eval !~ /ts\.aggregate/ }
    #dss.each_with_index do |_, i|
    #  unless dss[i].eval =~ /"\w+NS@\w+\.[a-z]"\.ts/i
    #    dss.delete_at(i)
    #  end
    #end
    if dss.count > 2
      puts ">>>>>>>>>>>>>> TOO MANY AGGS #{s} --#{s.id},"
      next
    end
    next if dss.count != 2

    if dss[0].eval =~ /"(\w+@\w+)\.([a-z])"\.ts\.aggregate\(:\w+, :(\w+)/i
      m0 = $1.upcase
      f0 = $2.upcase
      t0 = $3
    else
      next
    end
    if dss[1].eval =~ /"(\w+@\w+)\.([a-z])"\.ts\.aggregate\(:\w+, :(\w+)/i
      m1 = $1.upcase
      f1 = $2.upcase
      t1 = $3
    else
      next
    end
    if m0 != m1
      puts ">>>>>>>>>>>>>> BASE SERIES mismatch --#{s.id},"
      next
    end
    if t0 != t1
      puts ">>>>>>>>>>>>>> METHOD mismatch --#{s.id},"
      next
    end
    puts "----- DOING #{s} (#{s.id})\n\t#{dss[0].eval}\n\t#{dss[1].eval}"
    disablit = f0.freqn >= f1.freqn ? 1 : 0
    dss[disablit].disable!
  end
end

task :growth_rate_temp_fix => :environment do
  all = Series.search_box('^v #last_incomplete_year')
  all.each do |s|
    s.enabled_data_sources.each do |ld|
      next unless ld.eval =~ /last_incomplete_year/
      puts "------- DOING for #{s}"
      newval = ld.eval.sub('plete_year','plete_year("2020-01-01")')
      ld.update!(eval: newval)
    end
  end
end

## JIRA UA-1211
task :ua_1211 => :environment do
  DataSource.get_all_uhero.each do |ld|
    abs_path = %r{"(/Users/uhero/Documents)?/data/}
    if ld.eval =~ abs_path
      newval = ld.eval.sub(abs_path, '"')
      if newval =~ /load_.*sa_from.*"sadata"/
        newval.sub!(/\s*,\s*"sadata"\s*/, '')
      end
      ld.update!(eval: newval)  ## get rid of path prefix, just leave the double quote
    end
  end
  puts "!!!!! Go in the db and edit any remaining sheet name parameters for load*sa_from methods!"
end

## JIRA UA-1256
task :ua_1256 => :environment do
  DataSource.get_all_uhero.each do |ld|
    if ld.eval =~ /load_from_(bea|bls|fred|eia|estatjp|clustermapping|dvw)[^a-z]/
      api = $1
      puts ">>>> Changing #{ld.eval}"
      ld.update!(eval: ld.eval.sub("load_from_#{api}", "load_api_#{api}"))
      ld.reload
    end
    ld.set_color!
  end
end

## JIRA UA-1213
task :ua_1213 => :environment do
  all = Series.search_box('^pc .q #interpol')
  all.each do |s|
    dss = s.enabled_data_sources
    if dss.count > 2
      puts "#{s} >>>> more than 2, id #{s.id}"
      next
    end
    interp = dss[0].eval =~ /interpolate/ ? 0 : 1
    aggreg = (interp + 1) % 2
    unless dss[aggreg].eval =~ /aggregate/
      puts "#{s} >>>> no aggregate found, id #{s.id}"
      next
    end
    dss[interp].update!(priority: 100)
    dss[aggreg].update!(priority: 90)
    puts "#{s} --------- DONE"
  end
end

## JIRA UA-1259
task :ua_1259 => :environment do
  ss = Series.search_box('#load_from_bea')
  ss.each do |s|
    dss = s.enabled_data_sources
    next if dss.count < 2
    dss.each do |ds|
      next unless ds.eval =~ /from_download/
      if ds.last_error && ds.last_error !~ /404/
        puts "---- #{s} #{s.id} :: #{ds.last_error}"
        next
      end
      next unless ds.last_error
      next if ds.current?
      ds.disable!
    end
  end

  ss = Series.search_box('#load_from_bls !invalid')
  ss.each do |s|
    dss = s.enabled_data_sources.select {|x| x.eval =~ /load_from_bls/ }
    dss.each do |ds|
      next unless ds.last_error =~ /invalid/i && !ds.current?
      ds.disable!
    end
  end
end

## JIRA UA-1376
task :ua_1376 => :environment do
  allmeas = [
      "QW","Total Wages: All Industries",
      "QWAG","Total Wages: Agriculture",
      "QWMI","Total Wages: Mining",
      "QWUT","Total Wages: Utilities",
      "QWCON","Total Wages: Construction",
      "QWWT","Total Wages: Wholesale Trade",
      "QWIF","Total Wages: Information",
      "QWFI","Total Wages: Finance & Insurance",
      "QWRE","Total Wages: Real Estate & Rental",
      "QWPS","Total Wages: Prof., Scient., & Tech Svc. Jobs",
      "QWAD","Total Wages: Admin & Waste Services",
      "QWHC","Total Wages: Educational Services",
      "QWAE","Total Wages: Arts, Entertain. & Recreation",
      "QWAF","Total Wages: Accommodation & Food Svc. Jobs",
      "QWOS","Total Wages: Other Services",
      "QWUC","Total Wages: Unclassified",
      "QWMA","Total Wages: Management of Companies",
      "QWED","Total Wages: Educational Services",
      "QWW","Weekly Wages: All Industries",
      "QWWAG","Weekly Wages: Agriculture",
      "QWWMI","Weekly Wages: Mining",
      "QWWUT","Weekly Wages: Utilities",
      "QWWCON","Weekly Wages: Construction",
      "QWWWT","Weekly Wages: Wholesale Trade",
      "QWWIF","Weekly Wages: Information",
      "QWWFI","Weekly Wages: Finance & Insurance",
      "QWWRE","Weekly Wages: Real Estate & Rental",
      "QWWPS","Weekly Wages: Prof., Scient., & Tech Svc. Jobs",
      "QWWAD","Weekly Wages: Admin & Waste Services",
      "QWWHC","Weekly Wages: Educational Services",
      "QWWAE","Weekly Wages: Arts, Entertain. & Recreation",
      "QWWAF","Weekly Wages: Accommodation & Food Svc. Jobs",
      "QWWOS","Weekly Wages: Other Services",
      "QWWUC","Weekly Wages: Unclassified",
      "QWWMA","Weekly Wages: Management of Companies",
      "QWWED","Weekly Wages: Educational Services",
      "QWGDSPR","Total Wages: Goods Producing",
      "QWSVCPR","Total Wages: Service Producing",
      "QW111","Total Wages: Crop Production",
      "QW113","Total Wages: Forestry & Logging",
      "QW114","Total Wages: Fishing, Hunting, & Trapping",
      "QW212","Total Wages: Mining, Exc. Oil & Gas",
      "QWCTBL","Total Wages: Construction of Buildings",
      "QW237","Total Wages: Heavy & Civil Engr. Construction",
      "QWCTSP","Total Wages: Specialty Trade Contractors",
      "QW316","Total Wages: Leather Manufacturing",
      "QW321","Total Wages: Wood Prod. Manufacturing",
      "QW322","Total Wages: Paper Manufacturing",
      "QW323","Total Wages: Printing & Rel. Support",
      "QW324","Total Wages: Petroleum & Coal Prod. Manufacturing",
      "QW325","Total Wages: Chem. Manufacturing",
      "QW326","Total Wages: Plastic & Rubber Prod. Manufacturing",
      "QW327","Total Wages: Nonmet. Mineral Prod. Manufacturing",
      "QW331","Total Wages: Primary Metal Manufacturing",
      "QW332","Total Wages: Fabr. Metal Prod. Manufacturing",
      "QW333","Total Wages: Machinery Manufacturing",
      "QW334","Total Wages: CPU & Elec. Prod. Manufacturing",
      "QW335","Total Wages: Elec. Equip. & Appliance Manufacuring",
      "QW336","Total Wages: Transp. Equip. Manufacturing",
      "QW337","Total Wages: Furniture Manufacturing",
      "QW339","Total Wages: Misc. Manufacturing",
      "QW423","Total Wages: Wholesalers, Durable Goods",
      "QW424","Total Wages: Wholesalers, Nondurable Goods",
      "QW425","Total Wages: Elec. Mkts., Agents, Brokers",
      "QW441","Total Wages: Motor Vehicle & Parts Dealers",
      "QW442","Total Wages: Furniture Stores",
      "QW443","Total Wages: Elec. & Appliance Stores",
      "QW444","Total Wages: Bldg. Material & Garden Supp. Stores",
      "QW446","Total Wages: Health & Personal Care Stores",
      "QW447","Total Wages: Gas Stations",
      "QW451","Total Wages: Sporting Goods, Hobby, Book, & Music Stores",
      "QW453","Total Wages: Misc. Store Retailers",
      "QW454","Total Wages: Nonstore Retailers",
      "QW481","Total Wages: Air Transportation",
      "QW483","Total Wages: Water Transportation",
      "QW485","Total Wages: Transit & Ground Pass. Transportation",
      "QW486","Total Wages: Pipeline Transportation",
      "QW488","Total Wages: Supp. Act. For Transportation",
      "QW491","Total Wages: Postal Service",
      "QW492","Total Wages: Couriers & Messengers",
      "QW493","Total Wages: Warehousing & Storage",
      "QW511","Total Wages: Publishing Industries, excl. Internet",
      "QW512","Total Wages: Motion Picture & Sound Recording",
      "QW515","Total Wages: Broadcasting, excl. Internet",
      "QW518","Total Wages: Data Processing & Hosting Svcs.",
      "QW519","Total Wages: Other Information Services",
      "QW522","Total Wages: Credit Intermediation",
      "QW523","Total Wages: Securities, Comm. Contracts, Investments",
      "QW524","Total Wages: Insurance Carriers",
      "QW525","Total Wages: Funds, Trust, & Other Fin. Vehicles",
      "QW531","Total Wages: Real Estate",
      "QW532","Total Wages: Rental & Leasing Services",
      "QW533","Total Wages: Lessors of Nonfin. Intangible Assets",
      "QW541","Total Wages: Prof. & Tech. Svcs.",
      "QW551","Total Wages: Mgmt. of Companies & Enterprises",
      "QW561","Total Wages: Admin & Support Services",
      "QW562","Total Wages: Waste Mgmt. & Remediation Svcs.",
      "QW611","Total Wages: Educational Services",
      "QW621","Total Wages: Ambulatory Health Care Svcs.",
      "QW622","Total Wages: Hospitals",
      "QW623","Total Wages: Nursing & Residential Care Facilities",
      "QW624","Total Wages: Social Assistance",
      "QW711","Total Wages: Perf. Arts & Spectator Sports",
      "QW712","Total Wages: Museums, Hist. Sites, Zoos, & Parks",
      "QW713","Total Wages: Amusements & Recreation",
      "QWAFAC","Total Wages: Accommodation",
      "QWAFFD","Total Wages: Food Svc. & Drinking Places",
      "QW811","Total Wages: Repair & Maintenance",
      "QW812","Total Wages: Personal & Laundry Services",
      "QW813","Total Wages: Membership Assoc. & Organizations",
      "QW112","Total Wages: Animal Prod. & Aquaculture",
      "QW115","Total Wages: Agriculture & Forestry Supp.",
      "QW211","Total Wages: Oil & Gas Extraction",
      "QW221","Total Wages: Utilities",
      "QW311","Total Wages: Food Manufacturing",
      "QW445","Total Wages: Food & Beverage Stores",
      "QWRTCL","Total Wages: Clothing & Accessories Stores",
      "QW452","Total Wages: General Merchandise Stores",
      "QW484","Total Wages: Truck Transportation",
      "QW487","Total Wages: Scenic & Sightseeing Transportation",
      "QW517","Total Wages: Telecommunications",
      "QW315","Total Wages: Apparel Manufacturing",
      "QWWGDSPR","Weekly Wages: Goods Producing",
      "QWWSVCPR","Weekly Wages: Service Producing",
      "QWW111","Weekly Wages: Crop Production",
      "QWW113","Weekly Wages: Forestry & Logging",
      "QWW114","Weekly Wages: Fishing, Hunting, & Trapping",
      "QWW212","Weekly Wages: Mining, Exc. Oil & Gas",
      "QWWCTBL","Weekly Wages: Construction of Buildings",
      "QWW237","Weekly Wages: Heavy & Civil Engr. Construction",
      "QWWCTSP","Weekly Wages: Specialty Trade Contractors",
      "QWW316","Weekly Wages: Leather Manufacturing",
      "QWW321","Weekly Wages: Wood Prod. Manufacturing",
      "QWW322","Weekly Wages: Paper Manufacturing",
      "QWW323","Weekly Wages: Printing & Rel. Support",
      "QWW324","Weekly Wages: Petroleum & Coal Prod. Manufacturing",
      "QWW325","Weekly Wages: Chem. Manufacturing",
      "QWW326","Weekly Wages: Plastic & Rubber Prod. Manufacturing",
      "QWW327","Weekly Wages: Nonmet. Mineral Prod. Manufacturing",
      "QWW331","Weekly Wages: Primary Metal Manufacturing",
      "QWW332","Weekly Wages: Fabr. Metal Prod. Manufacturing",
      "QWW333","Weekly Wages: Machinery Manufacturing",
      "QWW334","Weekly Wages: CPU & Elec. Prod. Manufacturing",
      "QWW335","Weekly Wages: Elec. Equip. & Appliance Manufacuring",
      "QWW336","Weekly Wages: Transp. Equip. Manufacturing",
      "QWW337","Weekly Wages: Furniture Manufacturing",
      "QWW339","Weekly Wages: Misc. Manufacturing",
      "QWW423","Weekly Wages: Wholesalers, Durable Goods",
      "QWW424","Weekly Wages: Wholesalers, Nondurable Goods",
      "QWW425","Weekly Wages: Elec. Mkts., Agents, Brokers",
      "QWW441","Weekly Wages: Motor Vehicle & Parts Dealers",
      "QWW442","Weekly Wages: Furniture Stores",
      "QWW443","Weekly Wages: Elec. & Appliance Stores",
      "QWW444","Weekly Wages: Bldg. Material & Garden Supp. Stores",
      "QWW446","Weekly Wages: Health & Personal Care Stores",
      "QWW447","Weekly Wages: Gas Stations",
      "QWW451","Weekly Wages: Sporting Goods, Hobby, Book, & Music Stores",
      "QWW453","Weekly Wages: Misc. Store Retailers",
      "QWW454","Weekly Wages: Nonstore Retailers",
      "QWW481","Weekly Wages: Air Transportation",
      "QWW483","Weekly Wages: Water Transportation",
      "QWW485","Weekly Wages: Transit & Ground Pass. Transportation",
      "QWW486","Weekly Wages: Pipeline Transportation",
      "QWW488","Weekly Wages: Supp. Act. For Transportation",
      "QWW491","Weekly Wages: Postal Service",
      "QWW492","Weekly Wages: Couriers & Messengers",
      "QWW493","Weekly Wages: Warehousing & Storage",
      "QWW511","Weekly Wages: Publishing Industries, excl. Internet",
      "QWW512","Weekly Wages: Motion Picture & Sound Recording",
      "QWW515","Weekly Wages: Broadcasting, excl. Internet",
      "QWW518","Weekly Wages: Data Processing & Hosting Svcs.",
      "QWW519","Weekly Wages: Other Information Services",
      "QWW522","Weekly Wages: Credit Intermediation",
      "QWW523","Weekly Wages: Securities, Comm. Contracts, Investments",
      "QWW524","Weekly Wages: Insurance Carriers",
      "QWW525","Weekly Wages: Funds, Trust, & Other Fin. Vehicles",
      "QWW531","Weekly Wages: Real Estate",
      "QWW532","Weekly Wages: Rental & Leasing Services",
      "QWW533","Weekly Wages: Lessors of Nonfin. Intangible Assets",
      "QWW541","Weekly Wages: Prof. & Tech. Svcs.",
      "QWW551","Weekly Wages: Mgmt. of Companies & Enterprises",
      "QWW561","Weekly Wages: Admin & Support Services",
      "QWW562","Weekly Wages: Waste Mgmt. & Remediation Svcs.",
      "QWW611","Weekly Wages: Educational Services",
      "QWW621","Weekly Wages: Ambulatory Health Care Svcs.",
      "QWW622","Weekly Wages: Hospitals",
      "QWW623","Weekly Wages: Nursing & Residential Care Facilities",
      "QWW624","Weekly Wages: Social Assistance",
      "QWW711","Weekly Wages: Perf. Arts & Spectator Sports",
      "QWW712","Weekly Wages: Museums, Hist. Sites, Zoos, & Parks",
      "QWW713","Weekly Wages: Amusements & Recreation",
      "QWWAFAC","Weekly Wages: Accommodation",
      "QWWAFFD","Weekly Wages: Food Svc. & Drinking Places",
      "QWW811","Weekly Wages: Repair & Maintenance",
      "QWW812","Weekly Wages: Personal & Laundry Services",
      "QWW813","Weekly Wages: Membership Assoc. & Organizations",
      "QWW112","Weekly Wages: Animal Prod. & Aquaculture",
      "QWW115","Weekly Wages: Agriculture & Forestry Supp.",
      "QWW211","Weekly Wages: Oil & Gas Extraction",
      "QWW221","Weekly Wages: Utilities",
      "QWW311","Weekly Wages: Food Manufacturing",
      "QWW445","Weekly Wages: Food & Beverage Stores",
      "QWWRTCL","Weekly Wages: Clothing & Accessories Stores",
      "QWW452","Weekly Wages: General Merchandise Stores",
      "QWW484","Weekly Wages: Truck Transportation",
      "QWW487","Weekly Wages: Scenic & Sightseeing Transportation",
      "QWW517","Weekly Wages: Telecommunications",
      "QWW315","Weekly Wages: Apparel Manufacturing"
  ]
  loop do
    dpn = allmeas.pop || break
    pref = allmeas.pop || raise("doh! broken at #{dpn}")
    puts "------------------------> #{pref}"
    m = Measurement.create!(prefix: pref, data_portal_name: dpn, universe: 'UHERO')
    if dpn =~ /weekly/i
      units = 1
      unit_id = 20
    else ## total
      units = 1000000
      unit_id = 41
    end
    m.update_attributes!(unit_id: unit_id, source_id: 2, seasonal_adjustment: 'not_seasonally_adjusted')
    ss = Series.search_box("^#{pref}$")
    ss.each do |s|
      ns_name = s.build_name(prefix: s.parse_name[:prefix] + 'NS')
      d = s.data_sources.first
      if d
        d.update_attributes!(eval: d.eval.sub(s.name, ns_name))
      else
        puts "-=-=-=-=-> NO LOADER FOR #{s}"
      end
      s.rename(ns_name)
      s.update_attributes!(dataPortalName: dpn,
                           units: units,
                           unit_id: unit_id,
                           source_id: 2,
                           seasonal_adjustment: 'not_seasonally_adjusted')
      m.series << s
    end
    Measurement.deep_copy_to_universe([pref], 'CCOM')
  end
end

## JIRA UA-1342
task :ua_1342 => :environment do
  all = Series.search_box('#apply_ns_growth_rate_sa')
  all.each do |s|
    dss = s.enabled_data_sources
    if dss.count > 2
      puts "#{s} >>>> more than 2, id #{s.id}"
      next
    end
    gr = dss[0].eval =~ /apply_ns_growth_rate/ ? 0 : 1
    ngr = (gr + 1) % 2
    unless dss[ngr].eval =~ /county_share|share_using|load_mean_corrected|load_sa_from/
      puts "#{s} >>>> unexpected full year load, id #{s.id}"
      next
    end
    dss[ngr].update!(priority: 90, presave_hook: 'update_full_years_top_priority')
    dss[gr].update!(priority: 100, presave_hook: nil)
    puts "#{s} --------- DONE"
  end
end

## JIRA UA-1367
task :ua_1367 => :environment do
  prefixes = %w{
    BURNPOSTS HOMEBEMPL HOMEBHOURS HOMEBOPEN BNKRUPTTL BNKRUPCH7 BNKRUPCH13 BNKRUPOTHR E_NF E_PR E_GDSPR ECT EMN
    E_SVCPR EWT ERT E_TU EIF EFI ERE EPS EAD EMA EED EHC EAE EAF EAFAC EAFFD EOS EGV EGVFD EGVST EGVLC EAG YS_RB
    YS YSAG YSMI YSUT YSCT YSMN YSWT YSRT YSTW YSIF YSFI YSRE YSPS YSMA YSAD YSED YSHC YSAE YSAF YSAFAC YSAFFD
    YSOS YSGV YSGVFD YSGVML UIC UICINI WHCT WHMN WHWT WHRT WH_TTU WHIF WH_FIN WHAF WHAFAC WHAFFD
    KNRSD KNRSDSGF KNRSDMLT KP_RB KPPRV_RB KPPRVRSD_RB KPPRVCOM_RB KPPRVADD_RB KPGOV_RB KP KPPRV KPPRVRSD KPPRVCOM KPPRVADD KPGOV
    TGRRT TRFU OCUP% PRM RMRV TRMS CONSENT UHEP COVCASES NEWCOVCASES VAP_EP
    GOOGLERETA GOOGLEGROC GOOGLEPARK GOOGLETRAN GOOGLEWORK GOOGLERESI
    DESCMOB COVIDSRCH TRAFFIC MEIDAL WOMPMER WOMPREV
  }
  Measurement.deep_copy_to_universe(prefixes, 'CCOM')
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
    qa.enabled_data_sources.each {|ds| ds.disable! }
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
      ds.disable!
      disabled_one = true
    end
    if disabled_one
      s.data_sources.create(
          eval: '"%s".tsn.load_from("/Users/uhero/Documents/data/rparsed/QCEW_select.csv") / 1000' % s.name,
          priority: 100,
          color: 'CCFFFF'
      )
      puts "   CREATED NEW LOADER"
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
