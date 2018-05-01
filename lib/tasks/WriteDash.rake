task :write_sector_dash => :environment do
  next unless ((ENV.has_key? 'cms_user') and ENV.has_key? 'cms_pass')
  t = Time.now
  desc 'writes interactive job sector chart to website'
  
  view = ActionView::Base.new(ActionController::Base.view_paths, {})
  
  post_body = '' + view.render(:file=> '/dashboards/_sector_chart_final.html.erb')
  
  require 'mechanize'
  agent = Mechanize.new do |a|
    a.keep_alive = false
  end
  
  login_page = agent.get('http://www.uhero.hawaii.edu/admin/login')
  
  # dashboard
  login_page.form_with(:action => '/admin/login') do |f|
    f.send('data[User][login]=', ENV['cms_user'])
    f.send('data[User][pass]=', ENV['cms_pass'])
  end.click_button
  
  new_product_page = agent.get('http://www.uhero.hawaii.edu/admin/pages/edit/128')

  conf_page = new_product_page.form_with(:action => '/admin/pages/edit/128') do |f|
    f.send('data[Page][title]=', 'Job Sector Performance Visualization')
    f.send('data[Page][content]=', post_body)
    f.send('action=', '/admin/pages/edit/128/autoPublish:1')    
  end.click_button
  
  puts conf_page
  CSV.open('public/rake_time.csv', 'a') {|csv| csv << ['write_sector_dash', '%.2f' % (Time.now - t) , t.to_s, Time.now.to_s] }
end

task :write_empl_dash => :environment do
  next unless ((ENV.has_key? 'cms_user') and ENV.has_key? 'cms_pass')
  t = Time.now
  desc 'writes employment level charts to website'
  
  view = ActionView::Base.new(ActionController::Base.view_paths, {})
  
  post_body = '' + view.render(:file=> '/dashboards/_jobs_chart.html.erb')
  
  require 'mechanize'
  agent = Mechanize.new do |a|
    a.keep_alive = false
  end
  
  login_page = agent.get('http://www.uhero.hawaii.edu/admin/login')

  # dashboard
  login_page.form_with(:action => '/admin/login') do |f|
    f.send('data[User][login]=', ENV['cms_user'])
    f.send('data[User][pass]=', ENV['cms_pass'])
  end.click_button
  
  new_product_page = agent.get('http://www.uhero.hawaii.edu/admin/pages/edit/124')

  # conf page
  new_product_page.form_with(:action => '/admin/pages/edit/124') do |f|
    f.send('data[Page][title]=', 'Employment Levels in Hawaii')
    f.send('data[Page][content]=', post_body)
    f.send('action=', '/admin/pages/edit/124/autoPublish:1')
  end.click_button
  CSV.open('public/rake_time.csv', 'a') {|csv| csv << ['write_empl_dash', '%.2f' % (Time.now - t) , t.to_s, Time.now.to_s] }
end


task :write_ur_dash => :environment do
  next unless ((ENV.has_key? 'cms_user') and ENV.has_key? 'cms_pass')
  t = Time.now
  
  #now just updating these on the fly
  series_to_refresh = %w(UR@HI.M UR@HON.M UR@HAW.M UR@KAU.M UR@MAU.M)
  eval_statements = []
  errors = []
  Series.run_all_dependencies(series_to_refresh, {}, errors, eval_statements)
  
  post_name = 'Unemployment Rates in Hawaii (Seasonally Adjusted)'
  post_address ='http://www.uhero.hawaii.edu/123'
  new_data_series = {}
  series_to_refresh.map {|mnemonic| mnemonic.ts }.each {|series| new_data_series[series.name] = series.id if series.new_data?}
  
  #exit the task and skip writing to the website
  next if new_data_series.count == 0
  
  begin
    desc 'writes unemployment rate charts to website'
  
    view = ActionView::Base.new(ActionController::Base.view_paths, {})
  
    post_body = '' + view.render(:file=> '/dashboards/_unemployment_chart.html.erb')
    #post_body = "Hello World"
  
    require 'mechanize'
    agent = Mechanize.new do |a|
      a.keep_alive = false
    end
  
    login_page = agent.get('http://www.uhero.hawaii.edu/admin/login')

    # dashboard
    login_page.form_with(:action => '/admin/login') do |f|
     f.send('data[User][login]=', ENV['cms_user'])
     f.send('data[User][pass]=', ENV['cms_pass'])
    end.click_button
  
    new_product_page = agent.get('http://www.uhero.hawaii.edu/admin/pages/edit/123')
  

    # conf page
    new_product_page.form_with(:action => '/admin/pages/edit/123') do |f|
     f.send('data[Page][title]=', post_name)
     f.send('data[Page][content]=', post_body)
     f.send('action=', '/admin/pages/edit/123/autoPublish:1')
    end.click_button
    PackagerMailer.website_post_notification(post_name, post_address, new_data_series, true).deliver
  rescue
    PackagerMailer.website_post_notification(post_name, post_address, new_data_series, false).deliver
  end
  CSV.open('public/rake_time.csv', 'a') {|csv| csv << ['write_ur_dash', '%.2f' % (Time.now - t) , t.to_s, Time.now.to_s] }
end
