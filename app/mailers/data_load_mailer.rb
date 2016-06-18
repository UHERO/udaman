class DataLoadMailer < ActionMailer::Base
  default :from => 'udaman@hawaii.edu'

  def download_notification(update_info, update_summary)
    begin
      @update_info = update_info
      @update_summary = update_summary
      mail(:to => ['jrpage@hawaii.edu'], :subject => "A spreadsheet was updated (Udamacmini): #{update_info}")
    rescue => e
      mail(:to => ['jrpage@hawaii.edu'], :subject => '[UDAMACMINI] DataLoadMailer error', :body => e.message, :content_type => 'text/plain')
    end
  end

  def series_refresh_notification(circular_series, stale_data_sources, ds_count, errors)
    begin
      @circular_series = [*circular_series]
      @stale_data_sources = [*stale_data_sources]
      #add this in later
      #@empty_data_sources = empty_data_sources

      @errors = [*errors]
      mail(to: %w(jrpage@hawaii.edu james29@hawaii.edu ashleysh@hawaii.edu), subject: "[Udamacmini Series Reload] #{ds_count} Datasources loaded : #{@errors.count} / #{@circular_series.count} / #{@stale_data_sources.count} ")
    rescue => e
      @mailer_error = e.message
      mail(to: ['jrpage@hawaii.edu'], subject: '[UDAMACMINI] DataLoadMailer error', body: e.message, content_type: 'text/plain')
    end
  end
end
