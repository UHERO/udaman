class DataSourceDownload < ActiveRecord::Base
  belongs_to :data_source
  belongs_to :download
end
