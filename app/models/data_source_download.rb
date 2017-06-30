class DataSourceDownload < ActiveRecord::Base
  belongs_to :data_source
  belongs_to :download

  def DataSourceDownload.get_or_new(ds_id, dl_id)
    DataSourceDownload.find_by(data_source_id: ds_id, download_id: dl_id) ||
    DataSourceDownload.create(data_source_id: ds_id, download_id: dl_id)
  end

end
