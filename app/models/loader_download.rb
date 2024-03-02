class LoaderDownload < ApplicationRecord
  belongs_to :loader
  belongs_to :download

  def LoaderDownload.get_or_new(ldr_id, dl_id)
    LoaderDownload.find_by(loader_id: ldr_id, download_id: dl_id) || LoaderDownload.create(loader_id: ldr_id, download_id: dl_id)
  end

end
