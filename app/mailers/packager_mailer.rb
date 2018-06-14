class PackagerMailer < ActionMailer::Base
  default :from => 'udaman@hawaii.edu'

  def rake_notification(rake_task, download_results, errors, series, output_path, is_error)
    begin
      @download_results = download_results
      @errors = errors
      @series = series
      @output_path = output_path
      @dates = Series.get_all_dates_from_data(@series)
      subject = ''
      subject = "UDAMacMini Error (#{rake_task})" if is_error
      subject = "UDAMacMini New Download (#{rake_task})" unless is_error
      mail(:to => %w(vward@hawaii.edu djiann@hawaii.edu), :subject => subject)
    rescue => e
      mail(:to => %w(vward@hawaii.edu djiann@hawaii.edu), :subject => '[UDAMACMINI] PackageMailer.rake_notification error', :body => e.message, :content_type => 'text/plain')
    end
  end

  def rake_error(err, output_path)
    begin
      @error = err
      @output_path = output_path
      mail(:to => %w(vward@hawaii.edu djiann@hawaii.edu), :subject => 'Rake failed in an unexpected way (Udamacmini)')
    rescue => e
      mail(:to => %w(vward@hawaii.edu djiann@hawaii.edu), :subject => '[UDAMACMINI] PackageMailer.rake_error error', :body => e.message, :content_type => 'text/plain')
    end
  end

  # def visual_notification(new_dps = 0, changed_files = 0, new_downloads = 0)
  def visual_notification
    begin
      attachments.inline['photo.png'] = File.read(Rails.root.to_s + '/script/investigate_visual.png')
      attachments['photo.png'] = File.read(Rails.root.to_s + '/script/investigate_visual.png')

      recipients = %w(james29@hawaii.edu fuleky@hawaii.edu ashleysh@hawaii.edu vward@hawaii.edu djiann@hawaii.edu)
      subject = 'Udamacmini Download Report'
      mail(:to => recipients, :subject => subject)
    rescue => e
        puts e.message
      mail(:to => %w(vward@hawaii.edu djiann@hawaii.edu), :subject => '[UDAMACMINI] PackageMailer.visual_notification error', :body => e.message, :content_type => 'text/plain')
    end
  end

  def download_link_notification(handle = nil, url = nil, save_path = nil, created = false)
    begin
      subject = ''
      subject = "Udamacmini found and created a new download link for #{handle}" if created
      subject = "Udamacmini tried but failed to create a new download link for #{handle}" unless created
      @handle = handle
      @url = url
      @save_path = save_path
      mail(:to => %w(vward@hawaii.edu djiann@hawaii.edu), :subject => subject)
    rescue => e
      mail(:to => %w(vward@hawaii.edu djiann@hawaii.edu), :subject => '[UDAMACMINI] PackageMailer.download_link_notification error', :body => e.message, :content_type => 'text/plain')
    end
  end

  def website_post_notification(post_name, post_address, new_data_series, created)
    begin
      subject = ''
      subject = "Udamacmini: New data for #{post_name} posted to the UHERO website" if created
      subject = "Udamacmini tried but failed to post new data for #{post_name} to the UHERO website" unless created
      @post_address = post_address
      @new_data_series = new_data_series
      mail(:to => %w(james29@hawaii.edu vward@hawaii.edu djiann@hawaii.edu), :subject => subject) #{})
    rescue => e
      mail(:to => %w(vward@hawaii.edu djiann@hawaii.edu), :subject => '[UDAMACMINI] PackageMailer.website_post_notification error', :body => e.message, :content_type => 'text/plain')
    end
  end

  def circular_series_notification(series)
    begin
      @series = series
      mail(to: %w(djiann@hawaii.edu), subject: 'Circular Series')
    rescue => e
      puts e.message
      mail(:to => %w(djiann@hawaii.edu), :subject => 'PackageMailer.circular_series_notification error', :body => e.message, :content_type => 'text/plain')
    end
  end
end
